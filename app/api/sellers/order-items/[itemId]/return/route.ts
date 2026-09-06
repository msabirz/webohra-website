import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orderItems, orders } from '@/db/schema';
import { sellerReturnItemSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { canMarkReturned } from '@/lib/order-item-status';
import { openDisputeAsSeller } from '@/lib/disputes';

/**
 * POST /api/sellers/order-items/[itemId]/return — the COD return flow
 * (2026-09-06): she flags her own delivered COD item as returned and
 * opens a dispute in one action, so admin can verify with the buyer and
 * credit her wallet back (lib/disputes.ts's resolveDisputeWithCredit).
 * COD only — an online order's return still goes through the existing
 * refund tool instead, which already handles money moving back to the
 * buyer; this route is specifically for the case that tool refuses.
 */
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const sellerId = Number(session.sub);
  const { itemId } = await params;
  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, Number(itemId)));
  if (!item || item.sellerId !== sellerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, item.orderId));
  if (!order || order.paymentMethod !== 'cod') {
    return NextResponse.json({ error: 'This is only for Cash on Delivery orders.' }, { status: 400 });
  }

  if (!canMarkReturned(item.status)) {
    return NextResponse.json({ error: 'Only a delivered item can be marked returned.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerReturnItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await openDisputeAsSeller(item.orderId, sellerId, parsed.data.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  await db.update(orderItems).set({ status: 'returned', statusUpdatedAt: new Date() }).where(eq(orderItems.id, item.id));

  return NextResponse.json({ dispute: result.dispute }, { status: 201 });
}
