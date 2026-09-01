import { NextResponse } from 'next/server';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingVariants, listingImages } from '@/db/schema';
import { nameField } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({ name: nameField('Type name') });

/**
 * POST /api/listings/[idOrSlug]/convert-to-variants
 *
 * The retroactive-conversion path: a seller who published (or is still
 * drafting) a simple, single-price listing decides to add a second type.
 * Her existing price and photos don't get thrown away or duplicated —
 * they become the first variant, under whatever name she gives it here.
 * One atomic operation rather than the client orchestrating create-variant
 * + move-photos + null-out-price as three separate calls that could leave
 * things half-done if one of them failed partway through.
 *
 * No-op-proof: rejects if the listing is already variant-based (price is
 * already null) — this only ever runs once per listing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const [listing] = await db.select().from(listings).where(eq(listings.id, Number(id)));
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (listing.price === null) {
    return NextResponse.json({ error: 'This listing already uses different types' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [variant] = await db
    .insert(listingVariants)
    .values({
      listingId: listing.id,
      name: parsed.data.name,
      price: listing.price,
      stockQuantity: listing.stockQuantity,
      sortOrder: 0,
    })
    .returning();

  // Her existing photos (the ones with no variant) become this variant's
  // own photos — not left behind as a separate "general" gallery.
  await db
    .update(listingImages)
    .set({ variantId: variant.id })
    .where(and(eq(listingImages.listingId, listing.id), isNull(listingImages.variantId)));

  const [updatedListing] = await db
    .update(listings)
    .set({ price: null })
    .where(eq(listings.id, listing.id))
    .returning();

  return NextResponse.json({ listing: updatedListing, variant }, { status: 201 });
}
