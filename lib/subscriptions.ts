import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  sellerSubscriptions,
  subscriptionPlans,
  subscriptionSettings,
  subscriptionPayments,
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
    // Subscription-plan billing (item 27, 2026-09-07) — a PAID plan's
    // access lapses once its billing period ends. Checked lazily here
    // rather than via a cron, since every real caller (checkPublishGate
    // included) already goes through getActivePlan before trusting her
    // feature set — no separate sweep needed. `renewsAt` stays null for
    // every free plan (never expires) and for every seller grandfathered
    // onto a plan before this billing feature existed (see
    // scripts/grandfather-subscriptions.ts) — this check only ever fires
    // for a subscription that's actually been through real billing.
    if (subscription.renewsAt && subscription.renewsAt < new Date()) {
      await db.update(sellerSubscriptions).set({ status: 'lapsed' }).where(eq(sellerSubscriptions.id, subscription.id));
      return null;
    }
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

export type ActivateSubscriptionResult =
  | { ok: true; alreadyProcessed: boolean; renewsAt: Date }
  | { ok: false; error: string };

/**
 * Subscription-plan billing (item 27, 2026-09-07) — activates or renews a
 * PAID plan the moment a real, signature-verified Razorpay payment comes
 * back, called from both /api/sellers/subscriptions/verify (the fast,
 * browser-driven happy path) and the Razorpay webhook (the authoritative
 * fallback) — same "either path alone is enough" shape as
 * creditWalletTopup. Idempotent on `gatewayPaymentId`: a redelivered
 * webhook after the client-side verify already ran is a safe no-op, never
 * a double-activation or a double-counted payment row.
 *
 * Manual pay-again model (user's own explicit call, 2026-09-07, over a
 * real auto-renewing subscription): always exactly 30 days from THIS
 * payment, never extended from any remaining time on the old period —
 * switching plans or renewing early both simply reset the clock. Simpler
 * and safer to ship first; flagged here, not silently assumed.
 */
export async function activateSubscriptionPurchase(params: {
  sellerId: number;
  sellerType: SellerType;
  planId: number;
  amountRupees: number;
  gatewayPaymentId: string;
}): Promise<ActivateSubscriptionResult> {
  const [existingPayment] = await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.gatewayPaymentId, params.gatewayPaymentId));
  if (existingPayment) {
    return { ok: true, alreadyProcessed: true, renewsAt: existingPayment.periodEnd };
  }

  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, params.planId));
  if (!plan || !plan.active || plan.sellerType !== params.sellerType) {
    return { ok: false, error: 'This plan is no longer available — contact WeBohra support before this payment is lost.' };
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [existingSubscription] = await db
    .select()
    .from(sellerSubscriptions)
    .where(and(eq(sellerSubscriptions.sellerId, params.sellerId), eq(sellerSubscriptions.sellerType, params.sellerType)));

  const subscriptionValues = {
    billingMode: 'plan' as const,
    planId: params.planId,
    status: 'active' as const,
    renewsAt: periodEnd,
  };

  const paymentInsert = db.insert(subscriptionPayments).values({
    sellerId: params.sellerId,
    sellerType: params.sellerType,
    planId: params.planId,
    amount: params.amountRupees.toFixed(2),
    gatewayPaymentId: params.gatewayPaymentId,
    periodStart,
    periodEnd,
  });

  // Same atomic-batch reasoning as creditWalletTopup — the payment record
  // and the subscription-state update land together or not at all.
  if (existingSubscription) {
    await db.batch([
      paymentInsert,
      db.update(sellerSubscriptions).set(subscriptionValues).where(eq(sellerSubscriptions.id, existingSubscription.id)),
    ]);
  } else {
    await db.batch([
      paymentInsert,
      db.insert(sellerSubscriptions).values({
        sellerId: params.sellerId,
        sellerType: params.sellerType,
        startedAt: periodStart,
        ...subscriptionValues,
      }),
    ]);
  }

  return { ok: true, alreadyProcessed: false, renewsAt: periodEnd };
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
    pickupAddressSource: 'seller' | 'office' | 'other' | null;
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
  // Global kill switch (item 26, 2026-09-07) checked here too, not just
  // in the pickup-eligibility endpoint the form reads from — this route
  // is the real server-side authority a form-level check alone can never
  // fully replace (same "never trust the client" reasoning as every
  // other publish-gate check in this function).
  if (listing.pickupEnabled && listing.pickupAddressSource === 'office') {
    const [settings] = await db.select().from(subscriptionSettings).limit(1);
    if (settings && !settings.pickupOfficeFeatureEnabled) {
      return {
        ok: false,
        error: 'WeBohra office pickup is temporarily unavailable — switch this listing to pickup from your own address or a different one.',
        code: 'pickup_office_not_included',
      };
    }
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
