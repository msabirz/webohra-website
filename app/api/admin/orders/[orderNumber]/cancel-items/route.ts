import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders } from '@/db/schema';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { adminCancelItemsSchema } from '@/lib/validation';
import { cancelOrderItems } from '@/lib/order-cancellation';

/**
 * POST /api/admin/orders/[orderNumber]/cancel-items — Admin Panel
 * transaction/dispute/refund tooling, 2026-09-03. Cancels one or more line
 * items (true item-by-item selection — "cancel whole order" is just this
 * with every item id included) and, for an online-paid order, refunds
 * their combined amount in the same action. isAdmin, not isStaff — this
 * can move real money (the refund half), same "real-money action gets the
 * stricter role" reasoning as the plain refund route. Body:
 * { itemIds: number[], reason: string }.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderNumber } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminCancelItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = await cancelOrderItems(order.id, parsed.data.itemIds, Number(session!.sub), parsed.data.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
