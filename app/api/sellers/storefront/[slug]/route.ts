import { NextResponse } from 'next/server';
import { avg, count, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, users, jamaats, reviews } from '@/db/schema';

/**
 * GET /api/sellers/storefront/[slug] — Seller storefront (Tier 4, item
 * 24, 2026-09-07): the part of "seller onboarding beyond ITS" that
 * ISN'T blocked on the still-open SSO stakeholder question (see the
 * Technical TODO's own section 6b) — a public "everything this seller
 * sells" page is a pure buyer-browse feature over data that already
 * exists, unrelated to how she authenticates. Business-document upload
 * for KYC, the other half of that TODO line, stays parked — that one
 * genuinely depends on the SSO answer.
 *
 * Her actual listings are fetched separately via the existing
 * GET /api/listings?sellerSlug=... (reuses every bit of that route's
 * image/contactMode/rating resolution rather than re-deriving it here)
 * — this route is just her profile header: name, verification, jamaat
 * city, and an aggregate rating across every review on any of her
 * listings (reviews.sellerId is already denormalized for exactly this).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [profile] = await db
    .select({
      businessName: sellerProfiles.businessName,
      city: sellerProfiles.city,
      itsVerified: users.itsVerified,
      sellerId: sellerProfiles.userId,
      jamaatCity: jamaats.city,
    })
    .from(sellerProfiles)
    .innerJoin(users, eq(sellerProfiles.userId, users.id))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(eq(sellerProfiles.slug, slug));

  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [ratingRow] = await db
    .select({ average: avg(reviews.rating), count: count(reviews.id) })
    .from(reviews)
    .where(eq(reviews.sellerId, profile.sellerId));

  return NextResponse.json({
    seller: {
      businessName: profile.businessName,
      itsVerified: profile.itsVerified,
      // Her own city if she's set one, falling back to her jamaat's —
      // same "best available location" idea as the PDP's own pickup
      // resolution, just for display here, not eligibility.
      city: profile.city ?? profile.jamaatCity ?? null,
      rating: ratingRow?.count
        ? { average: Math.round(Number(ratingRow.average) * 10) / 10, count: ratingRow.count }
        : null,
    },
  });
}
