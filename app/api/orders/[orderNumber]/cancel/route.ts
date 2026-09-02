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
 *
 * A pending/failed online order cancels the same as any COD order — she
 * simply gave up on paying, nothing to refund. An already-paid online
 * order is a different matter (Fulfillment & Subscriptions redesign, Phase
 * 5b) — no refund mechanism exists yet, so self-cancelling it would make
 * real money vanish into the platform with nothing to show for it on
 * either side. Blocked here rather than silently "succeeding" with no
 * actual refund behind it.
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
  if (order.paymentMethod === 'online' && order.paymentStatus === 'paid') {
    return NextResponse.json(
      { error: 'This order is already paid — contact WeBohra support to cancel a paid order.' },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(orders)
    .set({ status: 'cancelled' })
    .where(eq(orders.id, order.id))
    .returning();

  return NextResponse.json({ order: { orderNumber: updated.orderNumber, status: updated.status } });
}
