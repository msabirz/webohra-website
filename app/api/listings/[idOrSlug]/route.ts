import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import {
  listings,
  subcategories,
  categories,
  users,
  sellerProfiles,
  jamaats,
  listingImages,
} from '@/db/schema';
import { db } from '@/db/index';
import { listingStatusUpdateSchema, listingUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * Accepts either the internal numeric id (used by the seller dashboard,
 * cart, and checkout — never exposed in a public URL) or the public slug
 * (used by the PDP/SDP route, app/(site)/listing/[slug]) — see slug's
 * comment in db/schema.ts for why the public one isn't the raw id.
 */
function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * GET /api/listings/[idOrSlug]
 *
 * Public listing detail (PDP for physical_product, SDP for local_service/
 * remote_service — SRS §1.3). Non-active listings 404 for anyone but their
 * own seller, so a draft link never accidentally leaks.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const [row] = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      description: listings.description,
      price: listings.price,
      shippingMethod: listings.shippingMethod,
      shippingEstimateText: listings.shippingEstimateText,
      status: listings.status,
      stockQuantity: listings.stockQuantity,
      createdAt: listings.createdAt,
      sellerId: listings.sellerId,
      subcategoryId: subcategories.id,
      subcategoryName: subcategories.name,
      subcategorySlug: subcategories.slug,
      listingType: subcategories.listingType,
      categoryName: categories.name,
      categorySlug: categories.slug,
      sellerPhone: users.phone,
      womenOwned: users.itsVerified,
      businessName: sellerProfiles.businessName,
      // The listing's "selling location" for Pickup & Pay eligibility — null
      // if the seller never set a jamaat (self-managed-shipping-only sellers).
      jamaatCity: jamaats.city,
    })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .innerJoin(users, eq(listings.sellerId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(resolveListingCondition(idOrSlug));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (row.status !== 'active') {
    const session = await getSessionFromRequest(request);
    const isOwner = session && Number(session.sub) === row.sellerId;
    if (!isOwner) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const images = await db
    .select({ id: listingImages.id, url: listingImages.url })
    .from(listingImages)
    .where(eq(listingImages.listingId, row.id))
    .orderBy(asc(listingImages.sortOrder));

  // Never expose the seller's raw phone number here — FR-37: it's surfaced
  // only through the Contact Seller / Take Consultation action itself, not
  // as browsable listing data.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sellerPhone: _sellerPhone, ...publicListing } = row;
  return NextResponse.json({ listing: { ...publicListing, images } });
}

/**
 * PATCH /api/listings/[idOrSlug]
 *
 * Owner-only status transitions: draft -> active ("Publish"), active/draft
 * -> archived (seller's own self-service unpublish), archived -> draft
 * (bring back). Publishing requires the seller to be ITS-verified (FR-7) —
 * until Admin verification exists, this means newly self-registered sellers
 * can prepare products but can't yet make them public, which is the correct
 * (if unfinished) behavior.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [listing] = await db.select().from(listings).where(resolveListingCondition(idOrSlug));
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (parsed.data.status === 'active') {
    const [seller] = await db.select().from(users).where(eq(users.id, listing.sellerId));
    if (!seller?.itsVerified) {
      return NextResponse.json(
        { error: 'Your ITS ID needs to be verified by Admin before you can publish listings' },
        { status: 403 },
      );
    }
  }

  const [updated] = await db
    .update(listings)
    .set({ status: parsed.data.status })
    .where(eq(listings.id, listing.id))
    .returning();

  return NextResponse.json({ listing: updated });
}

/**
 * PUT /api/listings/[idOrSlug]
 *
 * Owner-only full edit of a product's own fields (title, description,
 * price, shipping, stock). Status changes go through PATCH instead — kept
 * separate so "Publish" / "Archive" stay one-click actions that can't
 * accidentally overwrite the rest of the listing.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug } = await params;

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [listing] = await db.select().from(listings).where(resolveListingCondition(idOrSlug));
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { subcategoryId, title, description, price, shippingMethod, shippingEstimateText, stockQuantity } =
    parsed.data;

  const [updated] = await db
    .update(listings)
    .set({
      subcategoryId,
      title,
      description,
      price: price.toFixed(2),
      shippingMethod,
      shippingEstimateText: shippingMethod === 'self_managed' ? shippingEstimateText : null,
      stockQuantity: stockQuantity ?? null,
    })
    .where(eq(listings.id, listing.id))
    .returning();

  return NextResponse.json({ listing: updated });
}

/**
 * DELETE /api/listings/[idOrSlug]
 *
 * Owner-only hard delete — only allowed while the product has never been
 * ordered (order_items references listings with onDelete: 'restrict', so
 * this would otherwise fail at the DB level with an unfriendly error).
 * A product with order history should be archived instead, which keeps
 * order records intact.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const [listing] = await db.select().from(listings).where(resolveListingCondition(idOrSlug));
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await db.delete(listings).where(eq(listings.id, listing.id));
  } catch {
    return NextResponse.json(
      { error: 'This product has order history and can\'t be deleted — archive it instead.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
