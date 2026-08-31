import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders } from '@/db/schema';

/**
 * POST /api/orders/[orderNumber]/cancel
 *
 * Same trust model as GET /api/orders/[orderNumber] — whoever holds the
 * order number (her own confirmation link) can act on it, guest or not.
 * Only allowed while status is still 'placed': once there's real
 * seller-side progress tracking, this should key off that instead of this
 * one flat state (see orderStatusEnum in db/schema.ts).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (order.status !== 'placed') {
    return NextResponse.json({ error: 'This order can no longer be cancelled' }, { status: 409 });
  }

  const [updated] = await db
    .update(orders)
    .set({ status: 'cancelled' })
    .where(eq(orders.id, order.id))
    .returning();

  return NextResponse.json({ order: { orderNumber: updated.orderNumber, status: updated.status } });
}
