import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries, listings, sellerProfiles } from '@/db/schema';

/**
 * GET /api/requests/[requestNumber]
 *
 * Public consultation-request tracking — reachable by anyone with the
 * request number, same trust model as GET /api/orders/[orderNumber] (a
 * receipt-style link, not an authenticated lookup). Never exposes the
 * seller's phone (FR-37) — only status and listing/business context.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestNumber: string }> },
) {
  const { requestNumber } = await params;

  const [row] = await db
    .select({
      requestNumber: enquiries.requestNumber,
      buyerName: enquiries.buyerName,
      message: enquiries.message,
      status: enquiries.status,
      createdAt: enquiries.createdAt,
      viewedAt: enquiries.viewedAt,
      respondedAt: enquiries.respondedAt,
      rejectionReason: enquiries.rejectionReason,
      listingTitle: listings.title,
      listingSlug: listings.slug,
      businessName: sellerProfiles.businessName,
    })
    .from(enquiries)
    .innerJoin(listings, eq(enquiries.listingId, listings.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, enquiries.sellerId))
    .where(eq(enquiries.requestNumber, requestNumber));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ request: row });
}
