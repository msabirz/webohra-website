import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts, orders, users, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/payouts — every payout row, for Admin/Customer Support
 * oversight and to trigger a send. ?status= filters. `isMultiSeller`
 * (added 2026-09-03) flags a payout whose order also had other sellers in
 * it — lets Admin track which pending payouts belong to a mixed cart (the
 * ones her own /seller/payouts page tells her to expect ~7-8 working days
 * after delivery), messaging-only, no real settlement gate.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const conditions = [];
  if (status) {
    conditions.push(eq(payouts.status, status as 'pending' | 'processing' | 'processed' | 'failed' | 'reversed'));
  }

  const rows = await db
    .select({
      id: payouts.id,
      orderId: payouts.orderId,
      orderNumber: orders.orderNumber,
      sellerId: payouts.sellerId,
      businessName: sellerProfiles.businessName,
      sellerName: users.name,
      grossAmount: payouts.grossAmount,
      commissionAmount: payouts.commissionAmount,
      netAmount: payouts.netAmount,
      status: payouts.status,
      failureReason: payouts.failureReason,
      channel: payouts.channel,
      manualNote: payouts.manualNote,
      processedAt: payouts.processedAt,
      createdAt: payouts.createdAt,
    })
    .from(payouts)
    .innerJoin(orders, eq(payouts.orderId, orders.id))
    .innerJoin(users, eq(payouts.sellerId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, payouts.sellerId))
    .where(conditions.length ? and(...conditions) : undefined)
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
