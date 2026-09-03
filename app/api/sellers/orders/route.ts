import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/orders — orders containing at least one of the logged-in
 * seller's own products (derived from order_items.sellerId, since one
 * order can span multiple sellers). Total/item count here are scoped to
 * HER items only, not the whole order — she never sees another seller's
 * line items or their share of the total.
 *
 * An 'online' order that hasn't actually been paid for yet (Fulfillment &
 * Subscriptions redesign, Phase 5b) is excluded entirely — she has no
 * fulfillment work to do against money that never arrived, and seeing it
 * here would read as a real order to act on. Admin/Customer Support's own
 * order view is deliberately NOT filtered this way (see
 * /api/admin/orders' comment) — support needs full visibility to help a
 * buyer whose payment got stuck; only the seller-facing list hides it.
 * 'refunded' (added 2026-09-03, Admin Panel transaction/dispute/refund
 * tooling) is included alongside 'paid', deliberately NOT excluded the
 * way a never-paid order is — it was real, possibly-already-fulfilled
 * work, and a refund landing on it must never make it silently vanish
 * from her own order list.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const sellerId = Number(session.sub);

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      buyerName: orders.buyerName,
      city: orders.city,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      status: orders.status,
      createdAt: orders.createdAt,
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
      total: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.sellerId, sellerId),
        or(ne(orders.paymentMethod, 'online'), inArray(orders.paymentStatus, ['paid', 'refunded'])),
      ),
    )
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  return NextResponse.json({
    orders: rows.map((row) => ({ ...row, itemCount: Number(row.itemCount), total: Number(row.total) })),
  });
}
