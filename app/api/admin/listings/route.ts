import { NextResponse } from 'next/server';
import { and, asc, desc, eq, ilike, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  listings,
  subcategories,
  categories,
  sellerProfiles,
  users,
  listingImages,
} from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/listings — every listing across every seller, any status
 * (unlike the public GET /api/listings, which only ever returns 'active').
 * Backs FR-14's moderation view. Filters: ?status= ?category= ?q=
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const categorySlug = url.searchParams.get('category');
  const q = url.searchParams.get('q');

  const conditions = [];
  if (status) conditions.push(eq(listings.status, status as (typeof listings.status.enumValues)[number]));
  if (categorySlug) conditions.push(eq(categories.slug, categorySlug));
  if (q) conditions.push(ilike(listings.title, `%${q}%`));

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      price: listings.price,
      status: listings.status,
      moderationNote: listings.moderationNote,
      stockQuantity: listings.stockQuantity,
      createdAt: listings.createdAt,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      sellerId: listings.sellerId,
      businessName: sellerProfiles.businessName,
      sellerItsVerified: users.itsVerified,
    })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .innerJoin(users, eq(listings.sellerId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(listings.createdAt));

  const listingIds = rows.map((row) => row.id);
  const covers = listingIds.length
    ? await db
        .select({ listingId: listingImages.listingId, url: listingImages.url })
        .from(listingImages)
        .where(inArray(listingImages.listingId, listingIds))
        .orderBy(asc(listingImages.sortOrder))
    : [];
  const coverByListingId = new Map<number, string>();
  for (const cover of covers) {
    if (!coverByListingId.has(cover.listingId)) coverByListingId.set(cover.listingId, cover.url);
  }

  return NextResponse.json({
    listings: rows.map((row) => ({ ...row, coverImageUrl: coverByListingId.get(row.id) ?? null })),
  });
}
