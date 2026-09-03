import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders } from '@/db/schema';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { adminRefundSchema } from '@/lib/validation';
import { refundOrder } from '@/lib/refunds';

/**
 * POST /api/admin/orders/[orderNumber]/refund — Admin Panel transaction/
 * dispute/refund tooling, 2026-09-03. isAdmin, not isStaff — same
 * "real-money action gets the stricter role" reasoning as the payout
 * routes; Customer Support can see everything on the order-detail screen
 * but can't move money. Body: { amountRupees, reason }. See
 * lib/refunds.ts's refundOrder for the full validation/side-effect story
 * (partial refunds, the payout-already-sent auto-dispute flag, etc).
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderNumber } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminRefundSchema.safeParse(body);
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

  const result = await refundOrder(order.id, Number(session!.sub), parsed.data.amountRupees, parsed.data.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ refund: result.refund });
}
