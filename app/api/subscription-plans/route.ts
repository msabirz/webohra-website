import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionPlans } from '@/db/schema';

/**
 * GET /api/subscription-plans — the public/seller-facing plan list (unlike
 * /api/admin/subscription-plans, no staff session required — a seller
 * needs to browse these to actually choose one). Only ever active plans;
 * an archived tier stays visible to sellers already on it (their own
 * subscription row still points at it) but never shows up here as
 * something new to pick. ?sellerType= filters.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sellerType = url.searchParams.get('sellerType');
  const conditions = [eq(subscriptionPlans.active, true)];
  if (sellerType === 'product' || sellerType === 'service') {
    conditions.push(eq(subscriptionPlans.sellerType, sellerType));
  }

  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(and(...conditions))
    .orderBy(asc(subscriptionPlans.sellerType), asc(subscriptionPlans.sortOrder));

  return NextResponse.json({ plans });
}
