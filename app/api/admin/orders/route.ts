import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/orders — every order on the platform, deliberately
 * INCLUDING an 'online' order that hasn't been paid for yet (unlike
 * /api/sellers/orders, which hides those entirely — see its own comment).
 * Admin/Customer Support need full visibility to help a buyer whose
 * payment got stuck; `paymentStatus` in the response is what lets the UI
 * show that state clearly instead of implying every listed order is real,
 * fulfillable work. ?status= ?q= (order number, buyer name, or phone).
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');

  const conditions = [];
  if (status) conditions.push(eq(orders.status, status as 'placed' | 'cancelled'));
  if (q) {
    conditions.push(
      or(
        ilike(orders.orderNumber, `%${q}%`),
        ilike(orders.buyerName, `%${q}%`),
        ilike(orders.buyerPhone, `%${q}%`),
      ),
    );
  }

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      buyerName: orders.buyerName,
      buyerPhone: orders.buyerPhone,
      city: orders.city,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      status: orders.status,
      createdAt: orders.createdAt,
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
      total: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  return NextResponse.json({
    orders: rows.map((row) => ({ ...row, itemCount: Number(row.itemCount), total: Number(row.total) })),
  });
}
