import { NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingImages } from '@/db/schema';
import { listingImageAttachSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

const MAX_IMAGES_PER_LISTING = 8;

async function loadOwnedListing(id: number, sellerId: number) {
  const [listing] = await db.select().from(listings).where(eq(listings.id, id));
  if (!listing) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (listing.sellerId !== sellerId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { listing };
}

// variantId absent/null = the listing's own photos; set = one variant's own
// photos. Same table, same MAX_IMAGES_PER_LISTING cap, scoped independently
// per variant (so variant A's 8 photos don't block variant B's).
function variantScopeCondition(listingId: number, variantId: number | null) {
  return and(
    eq(listingImages.listingId, listingId),
    variantId === null ? isNull(listingImages.variantId) : eq(listingImages.variantId, variantId),
  );
}

/** GET /api/listings/[idOrSlug]/images — owner-only image list, in gallery
 *  order. ?variantId= scopes to one variant's own photos instead of the
 *  listing's own. */
export async function GET(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const { listing, error } = await loadOwnedListing(Number(id), Number(session.sub));
  if (error) return error;

  const url = new URL(request.url);
  const variantIdParam = url.searchParams.get('variantId');
  const variantId = variantIdParam ? Number(variantIdParam) : null;

  const images = await db
    .select()
    .from(listingImages)
    .where(variantScopeCondition(listing.id, variantId))
    .orderBy(asc(listingImages.sortOrder));

  return NextResponse.json({ images });
}

/**
 * POST /api/listings/[idOrSlug]/images
 *
 * Attaches an already-uploaded R2 object (see /api/uploads/presign) to a
 * product, or to one specific variant of it if the body includes
 * variantId. The new image is appended after the current highest
 * sortOrder within that same scope, so it lands last in the gallery — the
 * first-ever image becomes the cover.
 */
export async function POST(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const { listing, error } = await loadOwnedListing(Number(id), Number(session.sub));
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = listingImageAttachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const variantId = parsed.data.variantId ?? null;

  const existing = await db
    .select({ sortOrder: listingImages.sortOrder })
    .from(listingImages)
    .where(variantScopeCondition(listing.id, variantId));

  if (existing.length >= MAX_IMAGES_PER_LISTING) {
    return NextResponse.json(
      { error: `Up to ${MAX_IMAGES_PER_LISTING} photos` },
      { status: 400 },
    );
  }

  const nextSortOrder = existing.length
    ? Math.max(...existing.map((row) => row.sortOrder)) + 1
    : 0;

  const [image] = await db
    .insert(listingImages)
    .values({ listingId: listing.id, variantId, url: parsed.data.url, sortOrder: nextSortOrder })
    .returning();

  return NextResponse.json({ image }, { status: 201 });
}
