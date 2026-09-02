import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { pickupRequests, listings, sellerProfiles } from '@/db/schema';

/**
 * GET /api/pickup-requests/[trackingNumber]
 *
 * Public Pickup & Pay tracking — reachable by anyone with the tracking
 * number, same trust model as order/request tracking (see
 * GET /api/orders/[orderNumber]). Never exposes the seller's phone.
 *
 * The exact pickup address is only ever included when the listing's
 * current showAddressOnPdp is on, or the seller has marked this specific
 * request "ready for pickup" (readyForPickupAt) — the same reveal rule
 * GET /api/listings/[idOrSlug] applies on the PDP itself (planning doc
 * Decision 5). Read from the LIVE listing setting, not a value frozen at
 * request time, since a seller flipping this later should apply to
 * requests already in flight too. Until then, only the city is shown —
 * the seller still sees the real address in her own portal regardless.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackingNumber: string }> },
) {
  const { trackingNumber } = await params;

  const [row] = await db
    .select({
      trackingNumber: pickupRequests.trackingNumber,
      buyerName: pickupRequests.buyerName,
      requestedDate: pickupRequests.requestedDate,
      requestedTime: pickupRequests.requestedTime,
      requestedPlace: pickupRequests.requestedPlace,
      status: pickupRequests.status,
      readyForPickupAt: pickupRequests.readyForPickupAt,
      createdAt: pickupRequests.createdAt,
      listingTitle: listings.title,
      listingSlug: listings.slug,
      businessName: sellerProfiles.businessName,
      showAddressOnPdp: listings.showAddressOnPdp,
    })
    .from(pickupRequests)
    .innerJoin(listings, eq(pickupRequests.listingId, listings.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, pickupRequests.sellerId))
    .where(eq(pickupRequests.trackingNumber, trackingNumber));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const addressRevealed = row.showAddressOnPdp || !!row.readyForPickupAt;

  return NextResponse.json({
    request: {
      trackingNumber: row.trackingNumber,
      buyerName: row.buyerName,
      requestedDate: row.requestedDate,
      requestedTime: row.requestedTime,
      status: row.status,
      readyForPickup: !!row.readyForPickupAt,
      listingTitle: row.listingTitle,
      listingSlug: row.listingSlug,
      businessName: row.businessName,
      // Only the resolved address when revealed — otherwise the buyer just
      // gets told it'll be shared, same "never expose more than the
      // feature allows" pattern as sellerPhone elsewhere.
      place: addressRevealed ? row.requestedPlace : null,
      createdAt: row.createdAt,
    },
  });
}
