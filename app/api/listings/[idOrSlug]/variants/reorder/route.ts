import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingVariants } from '@/db/schema';
import { listingVariantReorderSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/** PATCH /api/listings/[idOrSlug]/variants/reorder — body: { order: number[] } (variant ids). */
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
  const parsed = listingVariantReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await Promise.all(
    parsed.data.order.map((variantId, index) =>
      db
        .update(listingVariants)
        .set({ sortOrder: index })
        .where(and(eq(listingVariants.id, variantId), eq(listingVariants.listingId, listing.id))),
    ),
  );

  return NextResponse.json({ ok: true });
}
