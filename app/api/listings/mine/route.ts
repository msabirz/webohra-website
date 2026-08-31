import { NextResponse } from 'next/server';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, subcategories, categories, listingImages } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/listings/mine — the logged-in seller's own products, any status.
 * Backs the products table (multi-select, bulk actions, Excel export) — see
 * app/seller/(portal)/products.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      price: listings.price,
      status: listings.status,
      stockQuantity: listings.stockQuantity,
      shippingMethod: listings.shippingMethod,
      createdAt: listings.createdAt,
      subcategoryId: subcategories.id,
      subcategoryName: subcategories.name,
      categoryName: categories.name,
      listingType: subcategories.listingType,
    })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .where(eq(listings.sellerId, Number(session.sub)))
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
