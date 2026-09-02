import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { pickupRequests, listings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/pickup-requests — her own Pickup & Pay requests. Always
 * shows the real resolved address (requestedPlace), regardless of that
 * listing's showAddressOnPdp — the privacy gating in
 * GET /api/listings/[idOrSlug] and GET /api/pickup-requests/[trackingNumber]
 * only ever controls what a BUYER sees before/without her confirming;
 * she needs the real address to actually be there. ?status= filters.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const sellerId = Number(session.sub);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const conditions = [eq(pickupRequests.sellerId, sellerId)];
  if (status) conditions.push(eq(pickupRequests.status, status as 'pending' | 'received' | 'issue'));

  const rows = await db
    .select({
      id: pickupRequests.id,
      trackingNumber: pickupRequests.trackingNumber,
      buyerName: pickupRequests.buyerName,
      buyerPhone: pickupRequests.buyerPhone,
      requestedDate: pickupRequests.requestedDate,
      requestedTime: pickupRequests.requestedTime,
      requestedPlace: pickupRequests.requestedPlace,
      status: pickupRequests.status,
      readyForPickupAt: pickupRequests.readyForPickupAt,
      createdAt: pickupRequests.createdAt,
      listingId: listings.id,
      listingTitle: listings.title,
    })
    .from(pickupRequests)
    .innerJoin(listings, eq(pickupRequests.listingId, listings.id))
    .where(and(...conditions))
    .orderBy(desc(pickupRequests.createdAt));

  return NextResponse.json({ pickups: rows });
}
