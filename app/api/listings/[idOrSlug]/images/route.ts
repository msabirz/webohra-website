import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
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

/** GET /api/listings/[idOrSlug]/images — owner-only image list, in gallery order. */
export async function GET(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const { listing, error } = await loadOwnedListing(Number(id), Number(session.sub));
  if (error) return error;

  const images = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id))
    .orderBy(asc(listingImages.sortOrder));

  return NextResponse.json({ images });
}

/**
 * POST /api/listings/[idOrSlug]/images
 *
 * Attaches an already-uploaded R2 object (see /api/uploads/presign) to a
 * product. The new image is appended after the current highest sortOrder,
 * so it lands last in the gallery — the first-ever image becomes the cover.
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

  const existing = await db
    .select({ sortOrder: listingImages.sortOrder })
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id));

  if (existing.length >= MAX_IMAGES_PER_LISTING) {
    return NextResponse.json(
      { error: `A product can have up to ${MAX_IMAGES_PER_LISTING} photos` },
      { status: 400 },
    );
  }

  const nextSortOrder = existing.length
    ? Math.max(...existing.map((row) => row.sortOrder)) + 1
    : 0;

  const [image] = await db
    .insert(listingImages)
    .values({ listingId: listing.id, url: parsed.data.url, sortOrder: nextSortOrder })
    .returning();

  return NextResponse.json({ image }, { status: 201 });
}
