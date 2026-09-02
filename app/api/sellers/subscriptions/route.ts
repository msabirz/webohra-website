import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerSubscriptions, subscriptionPlans } from '@/db/schema';
import { sellerSubscriptionChooseSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/subscriptions — her own subscription(s), one row per
 * seller_type she has (a mixed seller can have both). Empty for a seller
 * who's never chosen a plan yet — the /seller/subscription page handles
 * that state by showing the picker instead of a current-plan card.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const rows = await db
    .select({ subscription: sellerSubscriptions, plan: subscriptionPlans })
    .from(sellerSubscriptions)
    .leftJoin(subscriptionPlans, eq(sellerSubscriptions.planId, subscriptionPlans.id))
    .where(eq(sellerSubscriptions.sellerId, Number(session.sub)));

  return NextResponse.json({
    subscriptions: rows.map((r) => ({ ...r.subscription, plan: r.plan })),
  });
}

/**
 * PUT /api/sellers/subscriptions — choose a plan, or switch to a
 * different one, for one seller_type. Shell for now (no live billing,
 * same as the rest of this build) — this just records her choice; Phase 5
 * is what would ever actually charge her for it. Upserts: one row per
 * (seller, seller_type), matching the unique constraint on that table.
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

  const { sellerType, planId } = parsed.data;
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
  if (!plan || !plan.active || plan.sellerType !== sellerType) {
    return NextResponse.json(
      { error: 'Invalid input', issues: { planId: ['Select a valid, currently available plan'] } },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const [existing] = await db
    .select()
    .from(sellerSubscriptions)
    .where(and(eq(sellerSubscriptions.sellerId, sellerId), eq(sellerSubscriptions.sellerType, sellerType)));

  const [subscription] = existing
    ? await db
        .update(sellerSubscriptions)
        .set({ billingMode: 'plan', planId: plan.id, status: 'active' })
        .where(eq(sellerSubscriptions.id, existing.id))
        .returning()
    : await db
        .insert(sellerSubscriptions)
        .values({ sellerId, sellerType, billingMode: 'plan', planId: plan.id, status: 'active' })
        .returning();

  return NextResponse.json({ subscription: { ...subscription, plan } });
}
