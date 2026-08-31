import { NextResponse } from 'next/server';
import { and, desc, asc, eq, gte, ilike, inArray, lte } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  listings,
  subcategories,
  categories,
  users,
  sellerProfiles,
  jamaats,
  listingImages,
} from '@/db/schema';
import { listingCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { slugifyTitle, withUniqueSuffix } from '@/lib/ids';

/**
 * GET /api/listings
 *
 * Public browse/search feed — only ever returns `active` listings (drafts
 * and moderated-off listings are never visible off-portal). Supports the
 * public site's browse and search pages:
 *   ?category=<slug>  ?subcategory=<slug>  ?q=<title search>
 *   ?sort=newest|price_asc|price_desc   ?limit=&offset=
 *   ?minPrice=&maxPrice=   ?type=physical_product|local_service|remote_service
 *
 * ?nearCity=<city> backs the header's "Nearby" link (FR-3's nearby-first
 * ranking). There are no seller geocoordinates in this schema, only her
 * optional jamaat city (set if she registered planning Delhivery shipping —
 * see seller_profiles), so this is a coarse city-match proxy, not real
 * distance ranking. Sellers with no jamaat set never match it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get('category');
  const subcategorySlug = url.searchParams.get('subcategory');
  const q = url.searchParams.get('q');
  const nearCity = url.searchParams.get('nearCity');
  const sort = url.searchParams.get('sort') ?? 'newest';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 24, 60);
  const offset = Number(url.searchParams.get('offset')) || 0;
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const type = url.searchParams.get('type');

  const conditions = [eq(listings.status, 'active')];
  if (subcategorySlug) conditions.push(eq(subcategories.slug, subcategorySlug));
  if (categorySlug) conditions.push(eq(categories.slug, categorySlug));
  if (q) conditions.push(ilike(listings.title, `%${q}%`));
  if (nearCity) conditions.push(ilike(jamaats.city, nearCity));
  if (minPrice && !Number.isNaN(Number(minPrice))) conditions.push(gte(listings.price, minPrice));
  if (maxPrice && !Number.isNaN(Number(maxPrice))) conditions.push(lte(listings.price, maxPrice));
  if (type === 'physical_product' || type === 'local_service' || type === 'remote_service') {
    conditions.push(eq(subcategories.listingType, type));
  }

  const orderBy =
    sort === 'price_asc'
      ? asc(listings.price)
      : sort === 'price_desc'
        ? desc(listings.price)
        : desc(listings.createdAt);

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      price: listings.price,
      shippingMethod: listings.shippingMethod,
      createdAt: listings.createdAt,
      subcategoryId: subcategories.id,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      listingType: subcategories.listingType,
      categoryName: categories.name,
      categorySlug: categories.slug,
      businessName: sellerProfiles.businessName,
      womenOwned: users.itsVerified,
      jamaatCity: jamaats.city,
    })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .innerJoin(users, eq(listings.sellerId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

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

/**
 * POST /api/listings
 *
 * Creates a listing in `draft` status, owned by the authenticated seller
 * (from the session token — never trusted from the request body). Draft
 * listings never appear on GET /api/listings; see PATCH /api/listings/[id]
 * for publishing.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller to create a listing' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { subcategoryId, title, description, price, shippingMethod, shippingEstimateText, stockQuantity } =
    parsed.data;

  const baseSlug = slugifyTitle(title);
  const [existingSlug] = await db.select().from(listings).where(eq(listings.slug, baseSlug));
  const slug = existingSlug ? withUniqueSuffix(baseSlug) : baseSlug;

  const [listing] = await db
    .insert(listings)
    .values({
      slug,
      sellerId: Number(session.sub),
      subcategoryId,
      title,
      description,
      price: price.toFixed(2),
      shippingMethod,
      shippingEstimateText: shippingMethod === 'self_managed' ? shippingEstimateText : null,
      stockQuantity: stockQuantity ?? null,
      status: 'draft',
    })
    .returning();

  return NextResponse.json({ listing }, { status: 201 });
}
