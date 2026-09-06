import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, disputes } from '@/db/schema';
import { buyerDisputeCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { openDisputeAsBuyer } from '@/lib/disputes';

/**
 * /api/orders/[orderNumber]/disputes — "Report an issue," buyer-facing
 * (2026-09-06, marketplace-completeness scan: there was genuinely no way
 * for a buyer to raise her own dispute before this — only staff could
 * create one). Reachable by order number alone, same trust model as the
 * order confirmation page itself (GET /api/orders/[orderNumber]'s own
 * comment) — not gated behind matching phone/email, since a guest
 * checkout receipt link already works this way everywhere else in this
 * codebase.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [activeDispute] = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.orderId, order.id), inArray(disputes.status, ['open', 'investigating'])));
  return NextResponse.json({ activeDispute: activeDispute ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = buyerDisputeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // The precision fix (2026-09-06): a multi-seller order requires picking
  // which seller this is actually about, so the dispute doesn't bleed
  // through to a seller it has nothing to do with (see disputes.sellerId's
  // own schema comment). A single-seller order resolves it automatically.
  const items = await db.select({ sellerId: orderItems.sellerId }).from(orderItems).where(eq(orderItems.orderId, order.id));
  const sellerIds = Array.from(new Set(items.map((i) => i.sellerId)));

  let sellerId: number | null = null;
  if (sellerIds.length === 1) {
    sellerId = sellerIds[0];
  } else if (sellerIds.length > 1) {
    if (!parsed.data.sellerId || !sellerIds.includes(parsed.data.sellerId)) {
      return NextResponse.json(
        { error: 'This order has more than one seller — pick which one this is about.', code: 'seller_required' },
        { status: 400 },
      );
    }
    sellerId = parsed.data.sellerId;
  }

  const session = await getSessionFromRequest(request);
  const buyerId = session ? Number(session.sub) : null;

  const result = await openDisputeAsBuyer(order.id, buyerId, sellerId, parsed.data.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ dispute: result.dispute }, { status: 201 });
}
