import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, sellerProfiles, jamaats, pickupRequests } from '@/db/schema';
import { pickupRequestSchema } from '@/lib/validation';

/**
 * POST /api/pickup-requests
 *
 * Pickup & Pay, reshaped at the requester's direction into a booking-style
 * ask (see pickupRequests in db/schema.ts): she picks a date + place, no
 * payment happens here — the seller follows up off-platform within 24h.
 *
 * Eligibility (only offered when the buyer's location matches the seller's
 * pickup city) is enforced here too, not just hidden in the UI — a listing
 * whose seller has no jamaat set has no pickup city at all, so it's never
 * eligible.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = pickupRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { listingId, buyerName, buyerPhone, buyerCity, requestedDate, requestedPlace } =
    parsed.data;

  const [row] = await db
    .select({
      listingStatus: listings.status,
      sellerId: listings.sellerId,
      jamaatCity: jamaats.city,
    })
    .from(listings)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(eq(listings.id, listingId));

  if (!row || row.listingStatus !== 'active') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 });
  }

  if (!row.jamaatCity || row.jamaatCity.toLowerCase() !== buyerCity.toLowerCase()) {
    return NextResponse.json(
      { error: 'Pickup & Pay is only available near this seller’s pickup location' },
      { status: 403 },
    );
  }

  const [created] = await db
    .insert(pickupRequests)
    .values({
      listingId,
      sellerId: row.sellerId,
      buyerName,
      buyerPhone,
      requestedDate,
      requestedPlace,
    })
    .returning();

  return NextResponse.json({ pickupRequest: created }, { status: 201 });
}
