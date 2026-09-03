import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { adminOpenDisputeSchema } from '@/lib/validation';
import { openDispute } from '@/lib/disputes';

/**
 * POST /api/admin/orders/[orderNumber]/disputes — flags a new dispute
 * against this order. Admin Panel transaction/dispute/refund tooling,
 * 2026-09-03. isStaff, not isAdmin — flagging an issue for
 * investigation is a read/track action, not a money-moving one (unlike
 * the sibling /refund route); any staff member should be able to open
 * one. See lib/disputes.ts's openDispute for why only one active dispute
 * per order is ever allowed at once.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderNumber } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminOpenDisputeSchema.safeParse(body);
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

  const result = await openDispute(order.id, Number(session!.sub), parsed.data.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ dispute: result.dispute });
}
