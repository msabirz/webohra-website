import { NextResponse } from 'next/server';
import { and, desc, asc, eq, gte, ilike, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  listings,
  subcategories,
  categories,
  users,
  sellerProfiles,
  jamaats,
  listingImages,
  listingVariants,
} from '@/db/schema';
import { listingCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { slugifyTitle, withUniqueSuffix } from '@/lib/ids';
import { validateFieldValues, saveFieldValues, checkShippingEstimate } from '@/lib/listing-fields';
import { getActivePlan } from '@/lib/subscriptions';

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

  // A variant-based listing (price null) has no single price to sort/filter
  // on — it's ranked and range-matched by its cheapest type instead, same
  // number the card itself shows ("From ₹X"), so what a buyer filters by
  // and what she sees always agree.
  const variantMinPrice = db
    .select({
      listingId: listingVariants.listingId,
      minPrice: sql<string>`min(${listingVariants.price})`.as('min_price'),
    })
    .from(listingVariants)
    .groupBy(listingVariants.listingId)
    .as('variant_min_price');
  const displayPrice = sql<string>`coalesce(${listings.price}, ${variantMinPrice.minPrice})`;

  const conditions = [eq(listings.status, 'active')];
  if (subcategorySlug) conditions.push(eq(subcategories.slug, subcategorySlug));
  if (categorySlug) conditions.push(eq(categories.slug, categorySlug));
  if (q) conditions.push(ilike(listings.title, `%${q}%`));
  if (nearCity) conditions.push(ilike(jamaats.city, nearCity));
  if (minPrice && !Number.isNaN(Number(minPrice))) conditions.push(gte(displayPrice, minPrice));
  if (maxPrice && !Number.isNaN(Number(maxPrice))) conditions.push(lte(displayPrice, maxPrice));
  if (type === 'physical_product' || type === 'local_service' || type === 'remote_service') {
    conditions.push(eq(subcategories.listingType, type));
  }

  const orderBy =
    sort === 'price_asc'
      ? asc(displayPrice)
      : sort === 'price_desc'
        ? desc(displayPrice)
        : desc(listings.createdAt);

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      price: listings.price,
      displayPrice,
      shippingMethod: listings.shippingMethod,
      createdAt: listings.createdAt,
      sellerId: listings.sellerId,
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
    .leftJoin(variantMinPrice, eq(variantMinPrice.listingId, listings.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const listingIds = rows.map((row) => row.id);
  const variantBasedIds = rows.filter((row) => row.price === null).map((row) => row.id);

  const covers = listingIds.length
    ? await db
        .select({ listingId: listingImages.listingId, url: listingImages.url })
        .from(listingImages)
        .where(and(inArray(listingImages.listingId, listingIds), isNull(listingImages.variantId)))
        .orderBy(asc(listingImages.sortOrder))
    : [];
  // A variant-based listing has no general photos of its own — they all
  // live on its types instead — so its card falls back to the first type's
  // own photos, in type order then that type's own photo order.
  const variantCovers = variantBasedIds.length
    ? await db
        .select({ listingId: listingVariants.listingId, url: listingImages.url })
        .from(listingImages)
        .innerJoin(listingVariants, eq(listingImages.variantId, listingVariants.id))
        .where(inArray(listingVariants.listingId, variantBasedIds))
        .orderBy(asc(listingVariants.sortOrder), asc(listingImages.sortOrder))
    : [];

  // ListingCard's mini-slider only ever needs a few photos to page through,
  // not every one a seller uploaded — capped so a full page of 60 listings
  // can't balloon the response size for photos nobody will scroll to.
  const MAX_CARD_IMAGES = 5;
  const coverByListingId = new Map<number, string>();
  const imagesByListingId = new Map<number, string[]>();
  for (const img of [...covers, ...variantCovers]) {
    if (!coverByListingId.has(img.listingId)) coverByListingId.set(img.listingId, img.url);
    const existing = imagesByListingId.get(img.listingId);
    if (existing) {
      if (existing.length < MAX_CARD_IMAGES) existing.push(img.url);
    } else {
      imagesByListingId.set(img.listingId, [img.url]);
    }
  }

  // Service contact-tiering (2026-09-03) — the listing GRID card needs the
  // same tier-aware action GET /api/listings/[idOrSlug] already resolves
  // for the PDP (see that route's own comment for the full tier story);
  // this was missed when that work landed, so a card kept showing "Take
  // Consultation" regardless of a seller's actual plan. Resolved once per
  // unique service seller on the page (not once per row) to avoid a
  // redundant getActivePlan call for a seller with two listings in the
  // same page.
  const serviceSellerIds = [...new Set(rows.filter((r) => r.listingType !== 'physical_product').map((r) => r.sellerId))];
  const contactModeBySellerId = new Map<number, 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay'>();
  await Promise.all(
    serviceSellerIds.map(async (id) => {
      const plan = await getActivePlan(id, 'service');
      contactModeBySellerId.set(id, plan?.contactMode ?? 'masked_relay');
    }),
  );

  return NextResponse.json({
    listings: rows.map((row) => ({
      ...row,
      coverImageUrl: coverByListingId.get(row.id) ?? null,
      imageUrls: imagesByListingId.get(row.id) ?? [],
      contactMode: row.listingType === 'physical_product' ? null : (contactModeBySellerId.get(row.sellerId) ?? 'masked_relay'),
    })),
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

  const {
    subcategoryId,
    title,
    description,
    price,
    shippingMethod,
    shippingEstimateText,
    stockQuantity,
    fieldValues,
    selfShipCharge,
    pickupEnabled,
    pickupAddressSource,
    pickupLeadTimeHours,
    showAddressOnPdp,
    weight,
  } = parsed.data;

  const fieldCheck = await validateFieldValues(subcategoryId, fieldValues);
  if (!fieldCheck.ok) {
    return NextResponse.json({ error: 'Invalid input', issues: fieldCheck.issues }, { status: 400 });
  }

  const shippingCheck = await checkShippingEstimate(subcategoryId, shippingMethod, shippingEstimateText);
  if (!shippingCheck.ok) {
    return NextResponse.json({ error: 'Invalid input', issues: shippingCheck.issues }, { status: 400 });
  }

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
      // undefined here means "variant-based, no single price" — see
      // priceField's comment in lib/validation.ts.
      price: price !== undefined ? price.toFixed(2) : null,
      shippingMethod,
      shippingEstimateText: shippingMethod === 'self_managed' ? shippingEstimateText : null,
      stockQuantity: stockQuantity ?? null,
      status: 'draft',
      // Fulfillment & Subscriptions redesign, Phase 2 — all optional, all
      // default to today's exact behavior (no charge, Pickup & Pay off).
      selfShipCharge: selfShipCharge !== undefined ? selfShipCharge.toFixed(2) : null,
      pickupEnabled: pickupEnabled ?? false,
      pickupAddressSource: pickupEnabled ? (pickupAddressSource ?? null) : null,
      pickupLeadTimeHours: pickupLeadTimeHours ?? null,
      showAddressOnPdp: showAddressOnPdp ?? false,
      weight: weight !== undefined ? weight.toFixed(3) : null,
    })
    .returning();

  await saveFieldValues(listing.id, subcategoryId, fieldCheck.values);

  return NextResponse.json({ listing }, { status: 201 });
}
