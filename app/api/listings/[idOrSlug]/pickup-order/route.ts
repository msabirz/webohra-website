import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingVariants, orders, orderItems, shipments } from '@/db/schema';
import { pickupOrderSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { resolvePickupLocation } from '@/lib/pickup';
import { generateOrderNumber } from '@/lib/ids';
import { chargePickupAndPayCheckoutFee } from '@/lib/settlement';

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * POST /api/listings/[idOrSlug]/pickup-order
 *
 * Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — replaces the
 * old disconnected pickupRequests booking (app/api/pickup-requests, now
 * superseded, kept only for historical rows) with a real, order-linked
 * "buy now": creates an actual `orders` + `orderItems` row, plus a
 * `shipments` row (method: 'pickup_and_pay') carrying the real item
 * price and her chosen slot — same pattern as COD, just collected in
 * person instead of couriered, and now trackable through the exact same
 * /order/[orderNumber] page every other order type uses (the old
 * /pickup/[trackingNumber] page and its own tracking number are retired
 * for NEW bookings — see pickupRequests' own schema comment).
 *
 * Not a cart checkout — single-item "buy now" by design (the finalized
 * redesign's own wording), guest-friendly like COD (no account
 * required), quantity always 1.
 *
 * The first of the two commission stages fires here, immediately,
 * non-refundable — see lib/settlement.ts's chargePickupAndPayCheckoutFee.
 * The second fires later, when the seller confirms the buyer actually
 * collected it (app/api/sellers/orders/[orderNumber]'s PATCH route).
 */
export async function POST(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = pickupOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [listing] = await db.select().from(listings).where(resolveListingCondition(idOrSlug));
  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 });
  }
  if (!listing.pickupEnabled) {
    return NextResponse.json({ error: 'Pickup & Pay isn’t available for this listing' }, { status: 403 });
  }

  const location = await resolvePickupLocation(listing.sellerId, listing.pickupAddressSource);
  if (!location.city || !location.address) {
    return NextResponse.json(
      { error: 'Pickup & Pay isn’t ready for this listing yet — the seller hasn’t finished setting up her pickup location' },
      { status: 409 },
    );
  }
  if (location.city.toLowerCase() !== parsed.data.buyerCity.toLowerCase()) {
    return NextResponse.json(
      { error: 'Pickup & Pay is only available near this seller’s pickup location' },
      { status: 403 },
    );
  }

  const requestedAt = new Date(`${parsed.data.requestedDate}T${parsed.data.requestedTime}:00`);
  const leadTimeHours = listing.pickupLeadTimeHours ?? 0;
  const earliestAllowed = new Date(Date.now() + leadTimeHours * 60 * 60 * 1000);
  if (requestedAt < earliestAllowed) {
    return NextResponse.json(
      {
        error:
          leadTimeHours > 0
            ? `This seller needs at least ${leadTimeHours} hour${leadTimeHours === 1 ? '' : 's'}' notice — pick a later slot`
            : 'Pick a slot that hasn’t already passed',
        issues: { requestedTime: ['Pick a later slot'] },
      },
      { status: 400 },
    );
  }

  // Same either/or resolution as /api/orders — never trust a
  // client-supplied price.
  let unitPrice: string;
  let variantId: number | null = null;
  let variantName: string | null = null;
  if (parsed.data.variantId !== undefined) {
    const [variant] = await db.select().from(listingVariants).where(eq(listingVariants.id, parsed.data.variantId));
    if (!variant || variant.listingId !== listing.id) {
      return NextResponse.json({ error: 'That type is no longer available' }, { status: 409 });
    }
    unitPrice = variant.price;
    variantId = variant.id;
    variantName = variant.name;
  } else {
    if (listing.price === null) {
      return NextResponse.json(
        { error: 'This listing has different types — pick one before booking a pickup' },
        { status: 409 },
      );
    }
    unitPrice = listing.price;
  }

  const session = await getSessionFromRequest(request);

  let order;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    try {
      [order] = await db
        .insert(orders)
        .values({
          orderNumber: generateOrderNumber(),
          userId: session ? Number(session.sub) : null,
          buyerName: parsed.data.buyerName,
          buyerPhone: parsed.data.buyerPhone,
          buyerEmail: parsed.data.buyerEmail || null,
          // The seller's own resolved pickup address — not a delivery
          // destination, see orders.addressLine1's own schema comment.
          addressLine1: location.address.line1,
          addressLine2: location.address.line2,
          city: location.address.city,
          state: location.address.state,
          pincode: location.address.pincode,
          paymentMethod: 'pickup_and_pay',
        })
        .returning();
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  if (!order) {
    return NextResponse.json({ error: 'Could not place this booking — please try again' }, { status: 500 });
  }

  await db
    .insert(orderItems)
    .values({
      orderId: order.id,
      listingId: listing.id,
      sellerId: listing.sellerId,
      quantity: 1,
      unitPrice,
      variantId,
      variantName,
    })
    .returning();

  await db.insert(shipments).values({
    orderId: order.id,
    sellerId: listing.sellerId,
    method: 'pickup_and_pay',
    charge: null,
    addressLine1: location.address.line1,
    addressLine2: location.address.line2,
    city: location.address.city,
    state: location.address.state,
    pincode: location.address.pincode,
    pickupScheduledDate: parsed.data.requestedDate,
    pickupScheduledTime: parsed.data.requestedTime,
  });

  await chargePickupAndPayCheckoutFee({
    sellerId: listing.sellerId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    itemPriceRupees: Number(unitPrice),
  });

  return NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 });
}
