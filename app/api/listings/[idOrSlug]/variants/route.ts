import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, listingVariants } from '@/db/schema';
import { listingVariantCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

async function loadOwnedListing(id: number, sellerId: number) {
  const [listing] = await db.select().from(listings).where(eq(listings.id, id));
  if (!listing) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (listing.sellerId !== sellerId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { listing };
}

/** GET /api/listings/[idOrSlug]/variants — owner-only, in display order. */
export async function GET(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const { listing, error } = await loadOwnedListing(Number(id), Number(session.sub));
  if (error) return error;

  const variants = await db
    .select()
    .from(listingVariants)
    .where(eq(listingVariants.listingId, listing.id))
    .orderBy(asc(listingVariants.sortOrder));

  return NextResponse.json({ variants });
}

/**
 * POST /api/listings/[idOrSlug]/variants
 *
 * Adds one named, priced option — "Manda ₹40" — to a listing that's using
 * different types instead of one flat price. Doesn't touch listings.price
 * itself; that's set to null separately whenever the seller form is
 * submitted with no price (see priceField's comment in lib/validation.ts).
 */
export async function POST(request: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const { idOrSlug: id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });

  const { listing, error } = await loadOwnedListing(Number(id), Number(session.sub));
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = listingVariantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ sortOrder: listingVariants.sortOrder })
    .from(listingVariants)
    .where(eq(listingVariants.listingId, listing.id));
  const nextSortOrder = existing.length ? Math.max(...existing.map((row) => row.sortOrder)) + 1 : 0;

  const [variant] = await db
    .insert(listingVariants)
    .values({
      listingId: listing.id,
      name: parsed.data.name,
      price: parsed.data.price.toFixed(2),
      stockQuantity: parsed.data.stockQuantity ?? null,
      sortOrder: nextSortOrder,
    })
    .returning();

  return NextResponse.json({ variant }, { status: 201 });
}
