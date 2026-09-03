import { NextResponse } from 'next/server';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts, orders } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/payouts — her own payout history, newest first.
 * `isMultiSeller` (added 2026-09-03) flags a payout whose order also had
 * other sellers in it — messaging-only per the user's own call, no actual
 * settlement gate: her /seller/payouts page uses this to show the
 * "settles ~7-8 working days after delivery" note only where it's actually
 * relevant, rather than a blanket notice on every payout regardless of
 * cart composition.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: payouts.id,
      orderId: payouts.orderId,
      orderNumber: orders.orderNumber,
      grossAmount: payouts.grossAmount,
      commissionAmount: payouts.commissionAmount,
      netAmount: payouts.netAmount,
      status: payouts.status,
      failureReason: payouts.failureReason,
      processedAt: payouts.processedAt,
      createdAt: payouts.createdAt,
    })
    .from(payouts)
    .innerJoin(orders, eq(payouts.orderId, orders.id))
    .where(eq(payouts.sellerId, Number(session.sub)))
    .orderBy(desc(payouts.createdAt));

  const orderIds = Array.from(new Set(rows.map((r) => r.orderId)));
  const sellerCounts = orderIds.length
    ? await db
        .select({ orderId: payouts.orderId, sellerCount: sql<number>`count(distinct ${payouts.sellerId})` })
        .from(payouts)
        .where(inArray(payouts.orderId, orderIds))
        .groupBy(payouts.orderId)
    : [];
  const multiSellerOrderIds = new Set(sellerCounts.filter((r) => Number(r.sellerCount) > 1).map((r) => r.orderId));

  return NextResponse.json({
    payouts: rows.map(({ orderId, ...row }) => ({ ...row, isMultiSeller: multiSellerOrderIds.has(orderId) })),
  });
}
