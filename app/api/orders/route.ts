import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, orders, orderItems, listingVariants, shipments } from '@/db/schema';
import { orderCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { generateOrderNumber } from '@/lib/ids';

/**
 * POST /api/orders
 *
 * Checkout, guest-friendly per FR-5b (unlike Contact Seller, Buy Now/Add to
 * Cart doesn't require a buyer account). Price and seller are always looked
 * up server-side from the live listing (or its variant) — never trusted
 * from the cart. This is the "UI-only cart" shell: it creates a real order
 * + address record, but no payment is actually collected — payment_method
 * only ever accepts 'cod' right now (see paymentMethodEnum in
 * db/schema.ts).
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

  return NextResponse.json({ order, items: insertedItems, shipments: insertedShipments }, { status: 201 });
}
