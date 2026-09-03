import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts, orders, users, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/payouts — every payout row, for Admin/Customer Support
 * oversight and to trigger a send. ?status= filters.
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
      orderNumber: orders.orderNumber,
      sellerId: payouts.sellerId,
      businessName: sellerProfiles.businessName,
      sellerName: users.name,
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
    .innerJoin(users, eq(payouts.sellerId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, payouts.sellerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(payouts.createdAt));

  return NextResponse.json({ payouts: rows });
}
