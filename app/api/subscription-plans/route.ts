import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionPlans, subscriptionSettings } from '@/db/schema';

/**
 * GET /api/subscription-plans — the public/seller-facing plan list (unlike
 * /api/admin/subscription-plans, no staff session required — a seller
 * needs to browse these to actually choose one). Only ever active plans;
 * an archived tier stays visible to sellers already on it (their own
 * subscription row still points at it) but never shows up here as
 * something new to pick. ?sellerType= filters.
 *
 * Also returns the platform-wide recharge settings (Phase 5) — a plain
 * plan id and threshold, not sensitive, and it's what lets
 * /seller/subscription show a seller considering pay-as-you-go the real
 * feature set she'd get, instead of vague copy.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sellerType = url.searchParams.get('sellerType');
  const conditions = [eq(subscriptionPlans.active, true)];
  if (sellerType === 'product' || sellerType === 'service') {
    conditions.push(eq(subscriptionPlans.sellerType, sellerType));
  }

  const [plans, [settings]] = await Promise.all([
    db
      .select()
      .from(subscriptionPlans)
      .where(and(...conditions))
      .orderBy(asc(subscriptionPlans.sellerType), asc(subscriptionPlans.sortOrder)),
    db.select().from(subscriptionSettings).limit(1),
  ]);

  return NextResponse.json({
    plans,
    rechargeDefaultPlanId: settings?.rechargeDefaultPlanId ?? null,
    walletMinThreshold: settings?.walletMinThreshold ?? '0',
  });
}
