import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  sellerSubscriptions,
  subscriptionPlans,
  subscriptionSettings,
  listings,
  subcategories,
} from '@/db/schema';

export type SellerType = 'product' | 'service';

export function sellerTypeForListingType(
  listingType: 'physical_product' | 'local_service' | 'remote_service',
): SellerType {
  return listingType === 'physical_product' ? 'product' : 'service';
}

/**
 * Her currently active plan for one seller_type, or null if she has none at
 * all (never subscribed). A recharge-mode seller has a real seller_subscriptions
 * row but no planId of her own (see that column's comment) — her feature
 * set is Admin's configured rechargeDefaultPlanId instead (Fulfillment &
 * Subscriptions redesign, Phase 5), resolved here so every caller of this
 * function — the publish gate included — treats a funded recharge seller
 * exactly like a plan seller without needing to know the difference.
 */
export async function getActivePlan(sellerId: number, sellerType: SellerType) {
  const [subscription] = await db
    .select()
    .from(sellerSubscriptions)
    .where(
      and(
        eq(sellerSubscriptions.sellerId, sellerId),
        eq(sellerSubscriptions.sellerType, sellerType),
        eq(sellerSubscriptions.status, 'active'),
      ),
    );
  if (!subscription) return null;

  if (subscription.billingMode === 'plan') {
    if (!subscription.planId) return null;
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, subscription.planId));
    return plan ?? null;
  }

  // Recharge mode — Admin may not have configured a default plan yet
  // (subscription_settings.rechargeDefaultPlanId is nullable); that's a
  // real "no plan" state, not an error, same as any other unsubscribed
  // seller. rechargeDefaultPlanId is a single platform-wide id with its own
  // fixed sellerType, unlike a chosen plan (whose sellerType is validated to
  // match at selection time — see PUT /api/sellers/subscriptions) — if
  // Admin ever points it at the wrong type of plan, a wrong-typed plan
  // (e.g. a service seller silently getting product-plan fields, contactMode
  // included, all null) is worse than no plan at all, so that mismatch is
  // treated the same as "not configured."
  const [settings] = await db.select().from(subscriptionSettings).limit(1);
  if (!settings?.rechargeDefaultPlanId) return null;
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, settings.rechargeDefaultPlanId));
  if (!plan || plan.sellerType !== sellerType) return null;
  return plan;
}

/**
 * The actual publish gate — Phase 4 of the Fulfillment & Subscriptions
 * redesign. Every existing seller was grandfathered onto a real plan
 * before this ever went live (see scripts/grandfather-subscriptions.ts),
 * so this only ever blocks a seller with genuinely no subscription, or one
 * who's configured something her specific plan doesn't include. Checked
 * here (not just hidden in the seller form) for the same reason every
 * other gate in this codebase is server-side — the form doesn't know her
 * plan yet either, this is deliberately the one place that has to be
 * right.
 */
// A machine-readable reason alongside the human-readable `error` string
// (2026-09-04) — every one of these is an "upgrade your plan" situation,
// which the seller form surfaces as a popup (not just inline text) with a
// link straight to /seller/subscription, per the user's own ask: "if
// seller is trying to add more than a product than her subscribed
// package then show message in popup because that's important." A plain
// string-only error was too easy to conflate with an unrelated failure
// (network error, validation) that shouldn't get the same popup
// treatment.
export type PublishGateCode =
  | 'no_plan'
  | 'listing_limit'
  | 'pickup_not_included'
  | 'pickup_office_not_included'
  | 'delhivery_not_included';

export async function checkPublishGate(
  listing: {
    id: number;
    sellerId: number;
    subcategoryId: number;
    pickupEnabled: boolean;
    pickupAddressSource: 'seller' | 'office' | null;
    shippingMethod: 'self_managed' | 'delhivery';
  },
): Promise<{ ok: true } | { ok: false; error: string; code: PublishGateCode }> {
  const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, listing.subcategoryId));
  if (!subcategory) return { ok: false, error: 'Category not found', code: 'no_plan' };
  const sellerType = sellerTypeForListingType(subcategory.listingType);

  const plan = await getActivePlan(listing.sellerId, sellerType);
  if (!plan) {
    return {
      ok: false,
      error: `You need an active ${sellerType} plan to publish — choose one from your Subscription page.`,
      code: 'no_plan',
    };
  }

  if (plan.maxActiveListings !== null) {
    const [{ count: activeCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
      .where(
        and(
          eq(listings.sellerId, listing.sellerId),
          eq(listings.status, 'active'),
          eq(subcategories.listingType, subcategory.listingType),
          ne(listings.id, listing.id),
        ),
      );
    if (activeCount + 1 > plan.maxActiveListings) {
      return {
        ok: false,
        error: `Your ${plan.name} plan allows up to ${plan.maxActiveListings} active listing${plan.maxActiveListings === 1 ? '' : 's'} — you're at the limit. Archive one first, or upgrade your plan.`,
        code: 'listing_limit',
      };
    }
  }

  if (listing.pickupEnabled && !plan.allowsPickupAndPay) {
    return {
      ok: false,
      error: `Your ${plan.name} plan doesn't include Pickup & Pay — upgrade to enable it, or turn it off for this listing.`,
      code: 'pickup_not_included',
    };
  }
  if (listing.pickupEnabled && listing.pickupAddressSource === 'office' && !plan.pickupOfficeOption) {
    return {
      ok: false,
      error: `Your ${plan.name} plan doesn't include pickup from a WeBohra office — upgrade, or switch this listing to pickup from your own address.`,
      code: 'pickup_office_not_included',
    };
  }
  if (listing.shippingMethod === 'delhivery' && !plan.allowsDelhivery) {
    return {
      ok: false,
      error: `Your ${plan.name} plan doesn't include Delhivery shipping — upgrade, or switch this listing to self-managed shipping.`,
      code: 'delhivery_not_included',
    };
  }

  return { ok: true };
}
