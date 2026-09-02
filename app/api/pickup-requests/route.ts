import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, pickupRequests } from '@/db/schema';
import { pickupRequestSchema } from '@/lib/validation';
import { resolvePickupLocation } from '@/lib/pickup';
import { generatePickupTrackingNumber } from '@/lib/ids';

/**
 * POST /api/pickup-requests
 *
 * Pickup & Pay, reshaped at the requester's direction into a booking-style
 * ask (see pickupRequests in db/schema.ts): she picks a date + time, no
 * payment happens here — the seller follows up off-platform within 24h.
 *
 * Fulfillment & Subscriptions redesign, Phase 3: eligibility is now
 * per-listing (listings.pickupEnabled) rather than seller-wide, "place" is
 * resolved server-side from the listing's own pickupAddressSource instead
 * of buyer free text, the requested slot must respect the seller's own
 * minimum-notice window, and every request gets a public tracking number
 * — closing the one gap this pattern had versus orders/enquiries.
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

  const { listingId, buyerName, buyerPhone, buyerCity, requestedDate, requestedTime } = parsed.data;

  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId));
  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 });
  }

  if (!listing.pickupEnabled) {
    return NextResponse.json({ error: 'Pickup & Pay isn’t available for this listing' }, { status: 403 });
  }

  const location = await resolvePickupLocation(listing.sellerId, listing.pickupAddressSource);
  if (!location.city) {
    return NextResponse.json(
      { error: 'Pickup & Pay isn’t ready for this listing yet — the seller hasn’t finished setting up her pickup location' },
      { status: 409 },
    );
  }
  if (location.city.toLowerCase() !== buyerCity.toLowerCase()) {
    return NextResponse.json(
      { error: 'Pickup & Pay is only available near this seller’s pickup location' },
      { status: 403 },
    );
  }

  const requestedAt = new Date(`${requestedDate}T${requestedTime}:00`);
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

  // Always stores the real, resolved address for the seller/admin's own
  // view (she needs to know exactly where regardless of what a buyer sees)
  // — the privacy gating (showAddressOnPdp / readyForPickupAt) only
  // controls what's shown back to the BUYER on the tracking page, not what
  // gets recorded here.
  const resolvedPlace = location.address
    ? `${location.address.line1}${location.address.line2 ? `, ${location.address.line2}` : ''}, ${location.address.city}, ${location.address.state} ${location.address.pincode}`
    : location.city;

  let created;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      [created] = await db
        .insert(pickupRequests)
        .values({
          listingId,
          sellerId: listing.sellerId,
          buyerName,
          buyerPhone,
          requestedDate,
          requestedTime,
          requestedPlace: resolvedPlace,
          trackingNumber: generatePickupTrackingNumber(),
        })
        .returning();
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  if (!created) {
    return NextResponse.json({ error: 'Could not submit your request — please try again' }, { status: 500 });
  }

  return NextResponse.json({ pickupRequest: created }, { status: 201 });
}
