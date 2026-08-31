import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/orders — orders containing at least one of the logged-in
 * seller's own products (derived from order_items.sellerId, since one
 * order can span multiple sellers). Total/item count here are scoped to
 * HER items only, not the whole order — she never sees another seller's
 * line items or their share of the total.
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
      status: orders.status,
      createdAt: orders.createdAt,
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
      total: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.sellerId, sellerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  return NextResponse.json({
    orders: rows.map((row) => ({ ...row, itemCount: Number(row.itemCount), total: Number(row.total) })),
  });
}
