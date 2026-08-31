import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/orders/mine — order history for "My Profile", session-gated.
 * Only ever shows orders placed while she was signed in (userId set at
 * checkout time) — a guest order she placed before logging in has no way
 * to be linked back to her account.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const myOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  const result = await Promise.all(
    myOrders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      const total = items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        itemCount: items.length,
        total,
      };
    }),
  );

  return NextResponse.json({ orders: result });
}
