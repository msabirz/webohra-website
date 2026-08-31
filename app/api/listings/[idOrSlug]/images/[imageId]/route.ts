import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingImages } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { deleteUploadedObject, keyFromPublicUrl } from '@/lib/storage/r2';

/** DELETE /api/listings/[idOrSlug]/images/[imageId] — owner-only. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string; imageId: string }> },
) {
  const { idOrSlug: id, imageId } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const [listing] = await db.select().from(listings).where(eq(listings.id, Number(id)));
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [image] = await db
    .select()
    .from(listingImages)
    .where(and(eq(listingImages.id, Number(imageId)), eq(listingImages.listingId, listing.id)));
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(listingImages).where(eq(listingImages.id, image.id));

  const key = keyFromPublicUrl(image.url);
  if (key) await deleteUploadedObject(key);

  return NextResponse.json({ ok: true });
}
