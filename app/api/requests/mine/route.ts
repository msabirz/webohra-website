import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries, listings, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/requests/mine — a signed-in buyer's own consultation requests
 * (for "My Profile"), same pattern as GET /api/orders/mine. Only ever shows
 * requests submitted while she was signed in (buyerId set at request time)
 * — a guest request she made before logging in has no way to link back.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const rows = await db
    .select({
      requestNumber: enquiries.requestNumber,
      status: enquiries.status,
      createdAt: enquiries.createdAt,
      listingTitle: listings.title,
      listingSlug: listings.slug,
      businessName: sellerProfiles.businessName,
    })
    .from(enquiries)
    .innerJoin(listings, eq(enquiries.listingId, listings.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, enquiries.sellerId))
    .where(eq(enquiries.buyerId, Number(session.sub)))
    .orderBy(desc(enquiries.createdAt));

  return NextResponse.json({ requests: rows });
}
