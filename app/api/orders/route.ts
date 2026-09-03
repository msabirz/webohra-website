import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, orders, orderItems, listingVariants, shipments } from '@/db/schema';
import { orderCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { generateOrderNumber } from '@/lib/ids';
import { createRazorpayOrder, getRazorpayKeyId } from '@/lib/razorpay';

/**
 * POST /api/orders
 *
 * Checkout, guest-friendly per FR-5b (unlike Contact Seller, Buy Now/Add to
 * Cart doesn't require a buyer account). Price and seller are always looked
 * up server-side from the live listing (or its variant) — never trusted
 * from the cart. 'cod' stays a one-step "UI-only" shell exactly as before —
 * the order is the terminal action, nothing more to confirm. 'online'
 * (Fulfillment & Subscriptions redesign, Phase 5b) is real Razorpay
 * payment against the FULL cart total, any number of sellers included — a
 * single combined charge (mirrors how Phase 5b's own single-seller case
 * always worked, just generalized). This used to be gated to a
 * single-seller cart while payout-splitting depended on Razorpay Route,
 * which never got enabled on this account; that dependency is gone as of
 * the 2026-09-03 payout redesign (lib/payouts.ts's createPayoutsForOrder
 * has always been seller-count-agnostic, and Admin now settles each
 * seller's share directly rather than through any Razorpay split), so the
 * restriction was lifted the same day. An online order is still created
 * here immediately (paymentStatus: 'pending', a real Razorpay order
 * attached) so pricing is locked in at checkout time rather than
 * re-resolved later when payment actually clears — see
 * lib/order-payment.ts for how it then becomes 'paid', and
 * lib/payouts.ts's createPayoutsForOrder for how each seller's share gets
 * computed the moment it does, one payout row per seller in the order.
 *
 * If she's signed in, the order links to her account (userId) so it shows
 * up in her profile's order history — but an Authorization header is never
 * required here, since guest checkout must keep working.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = orderCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { items, buyerEmail, ...orderFields } = parsed.data;
  const listingIds = items.map((i) => i.listingId);
  const variantIds = items.map((i) => i.variantId).filter((id): id is number => id !== undefined);

  const [foundListings, foundVariants] = await Promise.all([
    db.select().from(listings).where(inArray(listings.id, listingIds)),
    variantIds.length
      ? db.select().from(listingVariants).where(inArray(listingVariants.id, variantIds))
      : Promise.resolve([]),
  ]);
  const listingById = new Map(foundListings.map((l) => [l.id, l]));
  const variantById = new Map(foundVariants.map((v) => [v.id, v]));

  // Resolves each item's real seller/price/name once, up front — both so
  // the validity checks below and the insert further down read from the
  // exact same resolution, and so a bad item fails the whole checkout
  // before any row is written rather than partway through.
  const resolved: Array<{
    listingId: number;
    sellerId: number;
    quantity: number;
    unitPrice: string;
    variantId: number | null;
    variantName: string | null;
  }> = [];

  for (const item of items) {
    const listing = listingById.get(item.listingId);
    if (!listing || listing.status !== 'active') {
      return NextResponse.json(
        { error: `Listing #${item.listingId} is no longer available` },
        { status: 409 },
      );
    }

    if (item.variantId !== undefined) {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.listingId !== listing.id) {
        return NextResponse.json(
          { error: `That type is no longer available for listing #${item.listingId}` },
          { status: 409 },
        );
      }
      resolved.push({
        listingId: listing.id,
        sellerId: listing.sellerId,
        quantity: item.quantity,
        unitPrice: variant.price,
        variantId: variant.id,
        variantName: variant.name,
      });
    } else {
      if (listing.price === null) {
        return NextResponse.json(
          { error: `Listing #${item.listingId} has different types — pick one before adding it to cart` },
          { status: 409 },
        );
      }
      resolved.push({
        listingId: listing.id,
        sellerId: listing.sellerId,
        quantity: item.quantity,
        unitPrice: listing.price,
        variantId: null,
        variantName: null,
      });
    }
  }

  // One shipment per (seller, method) — mirrors lib/cart-line.ts's
  // computeShipmentGroups exactly (see its own comment for why per-method,
  // not just per-seller, and why the charge applies once per shipment).
  // Computed from the same `listingById` lookup `resolved` already used,
  // so this can never disagree with what was actually validated above.
  const shipmentGroups = new Map<
    string,
    { sellerId: number; method: 'self_managed' | 'delhivery'; charge: number }
  >();
  for (const item of resolved) {
    const listing = listingById.get(item.listingId);
    if (!listing) continue;
    const key = `${item.sellerId}:${listing.shippingMethod}`;
    const itemCharge = listing.shippingMethod === 'self_managed' ? Number(listing.selfShipCharge ?? 0) : 0;
    const existing = shipmentGroups.get(key);
    if (existing) {
      existing.charge = Math.max(existing.charge, itemCharge);
    } else {
      shipmentGroups.set(key, { sellerId: item.sellerId, method: listing.shippingMethod, charge: itemCharge });
    }
  }

  const session = await getSessionFromRequest(request);

  // Order numbers are random, so a unique-constraint collision is possible
  // (astronomically unlikely, but cheap to guard) — retry a few times.
  let order;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    try {
      [order] = await db
        .insert(orders)
        .values({
          ...orderFields,
          buyerEmail: buyerEmail || null,
          orderNumber: generateOrderNumber(),
          userId: session ? Number(session.sub) : null,
          paymentStatus: parsed.data.paymentMethod === 'online' ? 'pending' : null,
        })
        .returning();
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  if (!order) {
    return NextResponse.json({ error: 'Could not place order — please try again' }, { status: 500 });
  }

  const insertedItems = await db
    .insert(orderItems)
    .values(
      resolved.map((item) => ({
        orderId: order.id,
        listingId: item.listingId,
        sellerId: item.sellerId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        variantId: item.variantId,
        variantName: item.variantName,
      })),
    )
    .returning();

  const insertedShipments = shipmentGroups.size
    ? await db
        .insert(shipments)
        .values(
          Array.from(shipmentGroups.values()).map((g) => ({
            orderId: order.id,
            sellerId: g.sellerId,
            method: g.method,
            // Null for methods with no real cost yet (delhivery — no live
            // rate lookup exists, planning doc Decision 4/7) rather than a
            // string '0.00' that would misleadingly claim a computed charge.
            charge: g.method === 'self_managed' ? g.charge.toFixed(2) : null,
          })),
        )
        .returning()
    : [];

  if (parsed.data.paymentMethod !== 'online') {
    return NextResponse.json({ order, items: insertedItems, shipments: insertedShipments }, { status: 201 });
  }

  // Server-computed total, never trusted from the checkout page — same
  // subtotal-plus-self-managed-shipping shape as lib/cart-line.ts's
  // frontend total (Delhivery shipments carry a null charge here, same
  // "no live rate lookup exists yet" reason as insertedShipments above, so
  // they contribute nothing to this figure either — nothing to disagree
  // with between the two).
  const totalRupees =
    resolved.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0) +
    insertedShipments.reduce((sum, s) => sum + Number(s.charge ?? 0), 0);

  const razorpayOrder = await createRazorpayOrder({
    amountRupees: totalRupees,
    receipt: order.orderNumber,
    notes: { orderNumber: order.orderNumber, purpose: 'order_payment' },
  });

  const [updatedOrder] = await db
    .update(orders)
    .set({ razorpayOrderId: razorpayOrder.id })
    .where(eq(orders.id, order.id))
    .returning();

  return NextResponse.json(
    {
      order: updatedOrder,
      items: insertedItems,
      shipments: insertedShipments,
      razorpay: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: getRazorpayKeyId(),
      },
    },
    { status: 201 },
  );
}
