import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/db/index';
import { disputes, orders, orderItems } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/disputes — every dispute on an order she has at least
 * one item in (2026-09-04, real gap the user's own audit caught — she had
 * zero visibility into a dispute opened against her before this, even the
 * "recover ₹X from you after a refund landed on an order you'd already
 * been paid out for" ones, per lib/disputes.ts's flagSellerRecoveryDispute
 * — she'd only ever find out if a staff member happened to contact her
 * outside the app).
 *
 * Read-only, and deliberately just the dispute's own reason/status/dates
 * — not the full internal comment timeline (see disputes' own schema
 * comment): that timeline can carry staff-to-staff notes (assignment
 * changes, internal deliberation) never meant for her to see.
 *
 * Precision fix, 2026-09-06: a dispute with a real `sellerId` (a buyer
 * reported it about one specific seller's item — see
 * lib/disputes.ts's openDisputeAsBuyer) is only ever visible to that one
 * seller, not every seller in the order. A dispute with no `sellerId`
 * (single-seller order, or an older/staff-created one predating this
 * column) still falls back to "any order she's part of," same boundary
 * /api/sellers/orders already uses.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const sellerId = Number(session.sub);

  const herOrderIds = await db
    .selectDistinct({ orderId: orderItems.orderId })
    .from(orderItems)
    .where(eq(orderItems.sellerId, sellerId));
  const orderIds = herOrderIds.map((r) => r.orderId);

  if (orderIds.length === 0) {
    return NextResponse.json({ disputes: [] });
  }

  const rows = await db
    .select({
      id: disputes.id,
      orderNumber: orders.orderNumber,
      status: disputes.status,
      reason: disputes.reason,
      createdAt: disputes.createdAt,
      resolvedAt: disputes.resolvedAt,
    })
    .from(disputes)
    .innerJoin(orders, eq(disputes.orderId, orders.id))
    .where(
      and(
        inArray(disputes.orderId, orderIds),
        or(isNull(disputes.sellerId), eq(disputes.sellerId, sellerId)),
      ),
    )
    .orderBy(desc(disputes.createdAt));

  return NextResponse.json({ disputes: rows });
}
