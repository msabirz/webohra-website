import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerSubscriptions, subscriptionPlans, listings, subcategories } from '@/db/schema';

export type SellerType = 'product' | 'service';

export function sellerTypeForListingType(
  listingType: 'physical_product' | 'local_service' | 'remote_service',
): SellerType {
  return listingType === 'physical_product' ? 'product' : 'service';
}

/** Her currently active plan for one seller_type, or null if she has none
 *  (never subscribed, or on the recharge model instead — recharge has no
 *  plan row at all, see seller_subscriptions.planId's own comment). */
export async function getActivePlan(sellerId: number, sellerType: SellerType) {
  const [row] = await db
    .select({ plan: subscriptionPlans })
    .from(sellerSubscriptions)
    .innerJoin(subscriptionPlans, eq(sellerSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(sellerSubscriptions.sellerId, sellerId),
        eq(sellerSubscriptions.sellerType, sellerType),
        eq(sellerSubscriptions.status, 'active'),
      ),
    );
  return row?.plan ?? null;
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
export async function checkPublishGate(
  listing: {
    id: number;
    sellerId: number;
    subcategoryId: number;
    pickupEnabled: boolean;
    pickupAddressSource: 'seller' | 'office' | null;
    shippingMethod: 'self_managed' | 'delhivery';
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, listing.subcategoryId));
  if (!subcategory) return { ok: false, error: 'Category not found' };
  const sellerType = sellerTypeForListingType(subcategory.listingType);

  const plan = await getActivePlan(listing.sellerId, sellerType);
  if (!plan) {
    return {
      ok: false,
      error: `You need an active ${sellerType} plan to publish — choose one from your Subscription page.`,
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
      };
    }
  }

  if (listing.pickupEnabled && !plan.allowsPickupAndPay) {
    return {
      ok: false,
      error: `Your ${plan.name} plan doesn't include Pickup & Pay — upgrade to enable it, or turn it off for this listing.`,
    };
  }
  if (listing.pickupEnabled && listing.pickupAddressSource === 'office' && !plan.pickupOfficeOption) {
    return {
      ok: false,
      error: `Your ${plan.name} plan doesn't include pickup from a WeBohra office — upgrade, or switch this listing to pickup from your own address.`,
    };
  }
  if (listing.shippingMethod === 'delhivery' && !plan.allowsDelhivery) {
    return {
      ok: false,
      error: `Your ${plan.name} plan doesn't include Delhivery shipping — upgrade, or switch this listing to self-managed shipping.`,
    };
  }

  return { ok: true };
}
