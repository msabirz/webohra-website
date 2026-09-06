import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings } from '@/db/schema';
import { getListingReviews } from '@/lib/reviews';

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * GET /api/listings/[idOrSlug]/reviews — public, the full review list +
 * aggregate behind a listing's PDP/SDP review section. Split out from the
 * main GET /api/listings/[idOrSlug] response (which only carries the
 * lightweight average/count) so a listing with many reviews doesn't bloat
 * every normal page load.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug } = await params;
  const [listing] = await db.select({ id: listings.id }).from(listings).where(resolveListingCondition(idOrSlug));
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const result = await getListingReviews(listing.id);
  return NextResponse.json(result);
}
