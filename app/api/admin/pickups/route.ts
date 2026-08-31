import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { pickupRequests, listings, sellerProfiles, jamaats } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/pickups — FR-47: Customer Support's queue of parcels
 * expected at each jamaat, for logging receipt (or flagging a seller who
 * didn't deliver in time). ?status= filters.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const conditions = [];
  if (status) conditions.push(eq(pickupRequests.status, status as 'pending' | 'received' | 'issue'));

  const rows = await db
    .select({
      id: pickupRequests.id,
      buyerName: pickupRequests.buyerName,
      buyerPhone: pickupRequests.buyerPhone,
      requestedDate: pickupRequests.requestedDate,
      requestedPlace: pickupRequests.requestedPlace,
      status: pickupRequests.status,
      notes: pickupRequests.notes,
      handledAt: pickupRequests.handledAt,
      createdAt: pickupRequests.createdAt,
      listingTitle: listings.title,
      businessName: sellerProfiles.businessName,
      jamaatCity: jamaats.city,
      jamaatName: jamaats.name,
    })
    .from(pickupRequests)
    .innerJoin(listings, eq(pickupRequests.listingId, listings.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, pickupRequests.sellerId))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(pickupRequests.createdAt));

  return NextResponse.json({ pickups: rows });
}
