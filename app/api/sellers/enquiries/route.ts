import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries, listings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/enquiries — the logged-in seller's own Take Consultation
 * requests, any status. Backs the Seller Portal's Enquiries page and bell
 * dropdown. ?status= filters.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const sellerId = Number(session.sub);

  const conditions = [eq(enquiries.sellerId, sellerId)];
  if (status) conditions.push(eq(enquiries.status, status as (typeof enquiries.status.enumValues)[number]));

  const rows = await db
    .select({
      id: enquiries.id,
      requestNumber: enquiries.requestNumber,
      buyerName: enquiries.buyerName,
      buyerPhone: enquiries.buyerPhone,
      message: enquiries.message,
      status: enquiries.status,
      createdAt: enquiries.createdAt,
      viewedAt: enquiries.viewedAt,
      respondedAt: enquiries.respondedAt,
      rejectionReason: enquiries.rejectionReason,
      listingId: listings.id,
      listingTitle: listings.title,
    })
    .from(enquiries)
    .innerJoin(listings, eq(enquiries.listingId, listings.id))
    .where(and(...conditions))
    .orderBy(desc(enquiries.createdAt));

  return NextResponse.json({ enquiries: rows });
}
