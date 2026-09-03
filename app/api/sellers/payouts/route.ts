import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts, orders } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/** GET /api/sellers/payouts — her own payout history, newest first. */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: payouts.id,
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

  return NextResponse.json({ payouts: rows });
}
