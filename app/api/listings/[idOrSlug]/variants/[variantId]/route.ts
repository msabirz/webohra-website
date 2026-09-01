import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingVariants, listingImages } from '@/db/schema';
import { listingVariantUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { deleteUploadedObject, keyFromPublicUrl } from '@/lib/storage/r2';

/** PATCH /api/listings/[idOrSlug]/variants/[variantId] — edit name/price/stock. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string; variantId: string }> },
) {
  const { idOrSlug: id, variantId } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const [listing] = await db.select().from(listings).where(eq(listings.id, Number(id)));
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [variant] = await db
    .select()
    .from(listingVariants)
    .where(and(eq(listingVariants.id, Number(variantId)), eq(listingVariants.listingId, listing.id)));
  if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = listingVariantUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(listingVariants)
    .set({
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.price !== undefined && { price: parsed.data.price.toFixed(2) }),
      ...(parsed.data.stockQuantity !== undefined && { stockQuantity: parsed.data.stockQuantity }),
    })
    .where(eq(listingVariants.id, variant.id))
    .returning();

  return NextResponse.json({ variant: updated });
}

/**
 * DELETE /api/listings/[idOrSlug]/variants/[variantId] — a real delete,
 * unlike subcategory_fields' archive-only model. Safe here: no order or
 * enquiry references a variant yet in this build (that's the buyer-facing
 * phase, not built yet), so there's nothing to orphan or silently corrupt.
 * Cascades to that variant's own listing_images rows.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string; variantId: string }> },
) {
  const { idOrSlug: id, variantId } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const [listing] = await db.select().from(listings).where(eq(listings.id, Number(id)));
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [variant] = await db
    .select()
    .from(listingVariants)
    .where(and(eq(listingVariants.id, Number(variantId)), eq(listingVariants.listingId, listing.id)));
  if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The DB rows cascade automatically (onDelete: 'cascade'), but the R2
  // objects behind them don't — clean those up first or they'd just leak
  // in storage forever, same reasoning as the single-image DELETE route.
  const images = await db
    .select({ url: listingImages.url })
    .from(listingImages)
    .where(eq(listingImages.variantId, variant.id));
  await Promise.all(
    images.map((img) => {
      const key = keyFromPublicUrl(img.url);
      return key ? deleteUploadedObject(key) : Promise.resolve();
    }),
  );

  await db.delete(listingVariants).where(eq(listingVariants.id, variant.id));
  return NextResponse.json({ ok: true });
}
