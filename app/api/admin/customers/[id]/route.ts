import { NextResponse } from 'next/server';
import { and, desc, eq, ne, or } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, orders } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { computeOrderTotalRupees } from '@/lib/order-total';

/** Real, collected money only — same condition as GET
 *  /api/admin/sellers/[userId] (a COD order always counts, an online one
 *  only once paid) so a customer's "lifetime spend" here means the same
 *  thing an admin sees anywhere else in this panel. */
const REAL_MONEY_CONDITION = or(ne(orders.paymentMethod, 'online'), eq(orders.paymentStatus, 'paid'));

/**
 * GET /api/admin/customers/[id] — one buyer's full order history and
 * lifetime spend, the customer-facing equivalent of the seller-360 view.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);

  const [customer] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id));
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const customerOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, id))
    .orderBy(desc(orders.createdAt));

  const ordersWithTotals = await Promise.all(
    customerOrders.map(async (order) => ({
      ...order,
      totalRupees: await computeOrderTotalRupees(order.id),
    })),
  );

  const [realMoneyOrders] = customerOrders.length
    ? [
        await db
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.userId, id), REAL_MONEY_CONDITION)),
      ]
    : [[]];
  const realMoneyIds = new Set(realMoneyOrders.map((o) => o.id));
  const lifetimeSpend = ordersWithTotals
    .filter((o) => realMoneyIds.has(o.id))
    .reduce((sum, o) => sum + o.totalRupees, 0);

  return NextResponse.json({
    customer: {
      ...customer,
      orderCount: customerOrders.length,
      lifetimeSpend,
    },
    orders: ordersWithTotals,
  });
}
