import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { isForwardMove, isOrderItemStatus } from '@/lib/order-item-status';

/**
 * PATCH /api/admin/orders/[orderNumber] — staff override for a line item's
 * fulfillment status, on behalf of any seller (unlike the seller's own
 * PATCH /api/sellers/orders/[orderNumber], this one isn't scoped to a
 * single sellerId — Customer Support needs to be able to nudge any
 * seller's item forward). Body: { itemId, status }. Order detail itself is
 * still read via the shared GET /api/orders/[orderNumber] — no separate
 * admin GET exists here, this route only adds the write.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderNumber } = await params;
  const body = await request.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const status = body?.status;

  if (!itemId || !isOrderItemStatus(status)) {
    return NextResponse.json({ error: 'itemId and a valid status are required' }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'This order was cancelled.' }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)));
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isForwardMove(item.status, status)) {
    return NextResponse.json({ error: `Can't move status backward from ${item.status}.` }, { status: 400 });
  }

  const [updated] = await db
    .update(orderItems)
    .set({ status, statusUpdatedAt: new Date() })
    .where(eq(orderItems.id, itemId))
    .returning();

  return NextResponse.json({ item: updated });
}
