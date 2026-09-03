import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, listings, subcategories, shipments } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { isForwardMove, isOrderItemStatus } from '@/lib/order-item-status';

/**
 * GET /api/sellers/orders/[orderNumber] — order detail, scoped to only the
 * logged-in seller's own line items. An order can span multiple sellers
 * (see checkout's cart), and she should never see another seller's items
 * or their share of the total — that's why this isn't just the shared
 * GET /api/orders/[orderNumber] with a session check bolted on.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { orderNumber } = await params;
  const sellerId = Number(session.sub);

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  // An unpaid online order isn't real work for her yet — same 404 as a
  // genuinely nonexistent order, not just hidden from the list (see
  // GET /api/sellers/orders' own comment), so a guessed order number
  // can't be used to peek at it either. 'refunded' (added 2026-09-03) is
  // explicitly allowed through here alongside 'paid' — it WAS real,
  // possibly-already-fulfilled work, and she needs continued visibility
  // into it (e.g. to know to stop fulfilling), unlike an order that was
  // never paid for at all.
  if (
    !order ||
    (order.paymentMethod === 'online' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded')
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const items = await db
    .select({
      id: orderItems.id,
      listingId: orderItems.listingId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      title: listings.title,
      subcategoryName: subcategories.name,
      variantName: orderItems.variantName,
      status: orderItems.status,
      statusUpdatedAt: orderItems.statusUpdatedAt,
    })
    .from(orderItems)
    .innerJoin(listings, eq(orderItems.listingId, listings.id))
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .where(and(eq(orderItems.orderId, order.id), eq(orderItems.sellerId, sellerId)));

  if (items.length === 0) {
    // Either this order doesn't exist, or none of it is hers — same 404
    // either way, so this can't be used to probe for order numbers.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Scoped to her own shipment(s) only, same reasoning as `items` above —
  // never another seller's charge on a multi-seller order.
  const sellerShipments = await db
    .select({ method: shipments.method, charge: shipments.charge })
    .from(shipments)
    .where(and(eq(shipments.orderId, order.id), eq(shipments.sellerId, sellerId)));

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
    },
    items,
    shipments: sellerShipments,
  });
}

/**
 * PATCH /api/sellers/orders/[orderNumber] — advance the fulfillment status
 * of one of HER OWN line items (never another seller's, even within the
 * same order — same scoping as GET above). Body: { itemId, status }.
 * Forward-only, and blocked entirely once the whole order is cancelled.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { orderNumber } = await params;
  const sellerId = Number(session.sub);
  const body = await request.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const status = body?.status;

  if (!itemId || !isOrderItemStatus(status)) {
    return NextResponse.json({ error: 'itemId and a valid status are required' }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  // Deliberately NOT extended to allow 'refunded' through here the way
  // GET above was — she can still see a refunded order, but advancing its
  // fulfillment status further would be wrong once the money's already
  // gone back to the buyer, so this keeps blocking on anything other than
  // a currently-real 'paid' state.
  if (!order || (order.paymentMethod === 'online' && order.paymentStatus !== 'paid')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'This order was cancelled.' }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id), eq(orderItems.sellerId, sellerId)));
  if (!item) {
    // Not her item (or it doesn't exist) — same 404 either way.
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
