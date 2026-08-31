import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, orders, orderItems } from '@/db/schema';
import { orderCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { generateOrderNumber } from '@/lib/ids';

/**
 * POST /api/orders
 *
 * Checkout, guest-friendly per FR-5b (unlike Contact Seller, Buy Now/Add to
 * Cart doesn't require a buyer account). Price and seller are always looked
 * up server-side from the live listing — never trusted from the cart. This
 * is the "UI-only cart" shell: it creates a real order + address record,
 * but no payment is actually collected — payment_method only ever accepts
 * 'cod' right now (see paymentMethodEnum in db/schema.ts).
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

  const foundListings = await db.select().from(listings).where(inArray(listings.id, listingIds));
  const listingById = new Map(foundListings.map((l) => [l.id, l]));

  for (const item of items) {
    const listing = listingById.get(item.listingId);
    if (!listing || listing.status !== 'active') {
      return NextResponse.json(
        { error: `Listing #${item.listingId} is no longer available` },
        { status: 409 },
      );
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
      items.map((item) => {
        const listing = listingById.get(item.listingId)!;
        return {
          orderId: order.id,
          listingId: listing.id,
          sellerId: listing.sellerId,
          quantity: item.quantity,
          unitPrice: listing.price,
        };
      }),
    )
    .returning();

  return NextResponse.json({ order, items: insertedItems }, { status: 201 });
}
