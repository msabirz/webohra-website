import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  listings,
  subcategories,
  categories,
  users,
  sellerProfiles,
  jamaats,
  listingImages,
  listingVariants,
  portfolioItems,
} from '@/db/schema';
import { db } from '@/db/index';
import { listingStatusUpdateSchema, listingUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import {
  validateFieldValues,
  saveFieldValues,
  getListingFieldValues,
  checkShippingEstimate,
} from '@/lib/listing-fields';
import { resolvePickupLocation } from '@/lib/pickup';
import { checkPublishGate } from '@/lib/subscriptions';

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
      // Fulfillment & Subscriptions redesign, Phase 2 — plain listing config,
      // safe to always include (her actual address text isn't resolved
      // here at all yet; that's Phase 3's job, and it's gated separately).
      selfShipCharge: listings.selfShipCharge,
      pickupEnabled: listings.pickupEnabled,
      pickupAddressSource: listings.pickupAddressSource,
      pickupLeadTimeHours: listings.pickupLeadTimeHours,
      showAddressOnPdp: listings.showAddressOnPdp,
      weight: listings.weight,
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

  // Scoped to the listing's own general photos — a variant-based listing's
  // real photos live on its variants instead (see variants below), and
  // without this filter they'd end up double-counted here too.
  const images = await db
    .select({ id: listingImages.id, url: listingImages.url })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, row.id), isNull(listingImages.variantId)))
    .orderBy(asc(listingImages.sortOrder));

  // Only a variant-based listing (price null) has any — cheap to always
  // query, but only worth shipping to the client when it's not simple.
  let variants: Array<{
    id: number;
    name: string;
    price: string;
    stockQuantity: number | null;
    images: { id: number; url: string }[];
  }> = [];
  if (row.price === null) {
    const variantRows = await db
      .select()
      .from(listingVariants)
      .where(eq(listingVariants.listingId, row.id))
      .orderBy(asc(listingVariants.sortOrder));

    const variantIds = variantRows.map((v) => v.id);
    const variantImageRows = variantIds.length
      ? await db
          .select({ id: listingImages.id, url: listingImages.url, variantId: listingImages.variantId })
          .from(listingImages)
          .where(inArray(listingImages.variantId, variantIds))
          .orderBy(asc(listingImages.sortOrder))
      : [];

    variants = variantRows.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      stockQuantity: v.stockQuantity,
      images: variantImageRows
        .filter((img) => img.variantId === v.id)
        .map((img) => ({ id: img.id, url: img.url })),
    }));
  }

  const fields = await getListingFieldValues(row.id);

  // Fulfillment & Subscriptions redesign, Phase 3 — per-listing Pickup &
  // Pay eligibility (planning doc Decision 5), replacing the old
  // seller-wide jamaat-city check. `pickupAddress` is only ever included
  // when she's opted this specific listing into showing it up front
  // (showAddressOnPdp) — same "never expose more than the feature
  // explicitly allows" rule as sellerPhone below. When it's off, the buyer
  // still gets `pickupCity` to check eligibility with, just not the exact
  // address — that's revealed later once a request exists (see
  // pickup_requests.readyForPickupAt).
  let pickupCity: string | null = null;
  let pickupAddress: { line1: string; line2: string | null; city: string; state: string; pincode: string } | null =
    null;
  if (row.pickupEnabled) {
    const location = await resolvePickupLocation(row.sellerId, row.pickupAddressSource);
    pickupCity = location.city;
    if (row.showAddressOnPdp) pickupAddress = location.address;
  }

  // Fulfillment & Subscriptions redesign, Phase 6 — her past-work showcase,
  // only ever fetched for a service listing (product PDPs don't render it
  // — see ServiceDetailView), so this skips the query entirely for the far
  // more common physical_product case.
  const portfolio =
    row.listingType === 'physical_product'
      ? []
      : await db
          .select({
            id: portfolioItems.id,
            title: portfolioItems.title,
            description: portfolioItems.description,
            link: portfolioItems.link,
            imageUrl: portfolioItems.imageUrl,
          })
          .from(portfolioItems)
          .where(eq(portfolioItems.sellerId, row.sellerId))
          .orderBy(asc(portfolioItems.sortOrder));

  // Never expose the seller's raw phone number here — FR-37: it's surfaced
  // only through the Contact Seller / Take Consultation action itself, not
  // as browsable listing data.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sellerPhone: _sellerPhone, ...publicListing } = row;
  return NextResponse.json({
    listing: { ...publicListing, images, variants, fields, pickupCity, pickupAddress, portfolio },
  });
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

    // Different-types listings publish once they have at least one type —
    // an empty menu would show a real buyer a page with nothing to pick
    // from or buy, which is worse than just staying a draft a little longer.
    if (listing.price === null) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(listingVariants)
        .where(eq(listingVariants.listingId, listing.id));
      if (count === 0) {
        return NextResponse.json(
          {
            error:
              'Add at least one type before publishing — buyers need something to pick from. You can keep managing types from the Products page in the meantime.',
          },
          { status: 400 },
        );
      }
    }

    // Fulfillment & Subscriptions redesign, Phase 4 — the actual
    // enforcement point. Every existing seller was grandfathered onto a
    // real plan before this shipped, so this only blocks someone with
    // genuinely no subscription, or a listing configured beyond what her
    // specific plan includes.
    const gate = await checkPublishGate(listing);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
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

  // Fulfillment & Subscriptions redesign, Phase 4. PATCH is where a listing
  // first crosses into active, but Save changes can just as easily flip
  // pickupEnabled/pickupAddressSource/shippingMethod on a listing that's
  // *already* active — without this, that edit would silently outrun
  // whatever her plan actually allows until she happened to unpublish and
  // republish. Draft listings skip this; PATCH re-checks them at publish
  // time regardless, and a draft that never satisfies her current plan
  // shouldn't be blocked from just being edited in the meantime.
  if (listing.status === 'active') {
    const resolvedPickupEnabled = pickupEnabled ?? false;
    const gate = await checkPublishGate({
      id: listing.id,
      sellerId: listing.sellerId,
      subcategoryId,
      pickupEnabled: resolvedPickupEnabled,
      pickupAddressSource: resolvedPickupEnabled ? (pickupAddressSource ?? null) : null,
      shippingMethod,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
    }
  }

  const [updated] = await db
    .update(listings)
    .set({
      subcategoryId,
      title,
      description,
      // undefined here means "variant-based, no single price" — the seller
      // form always sends a real price for a simple listing, so this only
      // ever nulls it out when she's genuinely using variants instead. See
      // priceField's comment in lib/validation.ts.
      price: price !== undefined ? price.toFixed(2) : null,
      shippingMethod,
      shippingEstimateText: shippingMethod === 'self_managed' ? shippingEstimateText : null,
      stockQuantity: stockQuantity ?? null,
      // Fulfillment & Subscriptions redesign, Phase 2.
      selfShipCharge: selfShipCharge !== undefined ? selfShipCharge.toFixed(2) : null,
      pickupEnabled: pickupEnabled ?? false,
      pickupAddressSource: pickupEnabled ? (pickupAddressSource ?? null) : null,
      pickupLeadTimeHours: pickupLeadTimeHours ?? null,
      showAddressOnPdp: showAddressOnPdp ?? false,
      weight: weight !== undefined ? weight.toFixed(3) : null,
    })
    .where(eq(listings.id, listing.id))
    .returning();

  await saveFieldValues(listing.id, subcategoryId, fieldCheck.values);

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
