import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerSubscriptions, subscriptionPlans, subscriptionSettings } from '@/db/schema';
import { sellerSubscriptionChooseSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { getOrCreateWallet } from '@/lib/wallet';
import { getActivePlan } from '@/lib/subscriptions';

/**
 * GET /api/sellers/subscriptions — her own subscription(s), one row per
 * seller_type she has (a mixed seller can have both). Empty for a seller
 * who's never chosen a plan yet — the /seller/subscription page handles
 * that state by showing the picker instead of a current-plan card. `plan`
 * is resolved through getActivePlan rather than a plain join, since a
 * recharge-mode row has no planId of its own — this is what lets the page
 * show her real, current feature set (Admin's rechargeDefaultPlanId)
 * instead of a blank card.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }
  const sellerId = Number(session.sub);

  const rows = await db.select().from(sellerSubscriptions).where(eq(sellerSubscriptions.sellerId, sellerId));

  const subscriptions = await Promise.all(
    rows.map(async (subscription) => ({
      ...subscription,
      plan: await getActivePlan(sellerId, subscription.sellerType),
    })),
  );

  return NextResponse.json({ subscriptions });
}

/**
 * PUT /api/sellers/subscriptions — choose a plan, switch to a different
 * one, or switch to pay-as-you-go (recharge), for one seller_type. Shell
 * for the 'plan' branch still (no live billing — this just records her
 * choice); the 'recharge' branch is real as of Phase 5: it's only ever
 * meaningful because /seller/wallet now has a genuine Razorpay top-up
 * behind it, not just an empty balance she'd be stuck at. Upserts: one row
 * per (seller, seller_type), matching the unique constraint on that table.
 */
export async function PUT(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerSubscriptionChooseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const { sellerType, billingMode } = parsed.data;

  let plan: typeof subscriptionPlans.$inferSelect | null = null;
  if (billingMode === 'plan') {
    const [selectedPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, parsed.data.planId));
    if (!selectedPlan || !selectedPlan.active || selectedPlan.sellerType !== sellerType) {
      return NextResponse.json(
        { error: 'Invalid input', issues: { planId: ['Select a valid, currently available plan'] } },
        { status: 400 },
      );
    }
    plan = selectedPlan;
  } else {
    // Recharge mode needs Admin to have configured a default feature set
    // first (subscription_settings.rechargeDefaultPlanId) — without one,
    // there's nothing to actually give her, so this isn't offered as a
    // choice yet rather than silently leaving her with zero features. Also
    // requires that default plan to actually be a `sellerType` plan — it's
    // a single platform-wide id with its own fixed type (see
    // getActivePlan's own comment on this), so a mismatched configuration
    // gets the same clear rejection rather than switching her into a
    // recharge subscription that would silently resolve to no plan later.
    const [settings] = await db.select().from(subscriptionSettings).limit(1);
    const [defaultPlan] = settings?.rechargeDefaultPlanId
      ? await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, settings.rechargeDefaultPlanId))
      : [];
    if (!defaultPlan || !defaultPlan.active || defaultPlan.sellerType !== sellerType) {
      return NextResponse.json(
        { error: "Pay-as-you-go isn't available for this yet — check back soon, or choose a plan instead." },
        { status: 400 },
      );
    }
    plan = defaultPlan;
    // Ensures her wallet exists (at ₹0) the moment she opts into recharge,
    // so /seller/wallet never has to handle a "not set up yet" state for a
    // seller who's actually chosen this mode.
    await getOrCreateWallet(sellerId);
  }

  const [existing] = await db
    .select()
    .from(sellerSubscriptions)
    .where(and(eq(sellerSubscriptions.sellerId, sellerId), eq(sellerSubscriptions.sellerType, sellerType)));

  const values = {
    billingMode,
    planId: billingMode === 'plan' ? parsed.data.planId : null,
    status: 'active' as const,
  };

  const [subscription] = existing
    ? await db
        .update(sellerSubscriptions)
        .set(values)
        .where(eq(sellerSubscriptions.id, existing.id))
        .returning()
    : await db
        .insert(sellerSubscriptions)
        .values({ sellerId, sellerType, ...values })
        .returning();

  return NextResponse.json({ subscription: { ...subscription, plan } });
}
