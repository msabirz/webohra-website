import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
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
 * changes, internal deliberation) never meant for her to see. If a
 * multi-seller order has a dispute, she sees it too — disputes aren't
 * structurally scoped to one seller (no sellerId column on the table
 * itself, see the schema's own comment), so "any order she's part of" is
 * the honest boundary, same one /api/sellers/orders already uses.
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
    .where(inArray(disputes.orderId, orderIds))
    .orderBy(desc(disputes.createdAt));

  return NextResponse.json({ disputes: rows });
}
