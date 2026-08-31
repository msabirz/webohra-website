import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingImages } from '@/db/schema';
import { listingImagesReorderSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * PATCH /api/listings/[idOrSlug]/images/reorder
 *
 * Body: { order: number[] } — image ids in the new gallery order (the first
 * one becomes the cover photo everywhere a single thumbnail is shown).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const [listing] = await db.select().from(listings).where(eq(listings.id, Number(id)));
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingImagesReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await Promise.all(
    parsed.data.order.map((imageId, index) =>
      db
        .update(listingImages)
        .set({ sortOrder: index })
        .where(and(eq(listingImages.id, imageId), eq(listingImages.listingId, listing.id))),
    ),
  );

  return NextResponse.json({ ok: true });
}
