import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listingPins, listings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

const pinSchema = z.object({ guestId: z.string().min(1).max(100).optional() });

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * POST /api/listings/[idOrSlug]/pin — toggles a Pin (FR-5b: the one
 * interest-expression action a guest buyer can take, no registration
 * required). A registered buyer's session identifies her; a guest passes a
 * client-generated id instead (stored in her own browser, not tied to an
 * account). Currently unused by the UI (Pin was pulled temporarily) but
 * kept working since the data model and route are still in place.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(resolveListingCondition(idOrSlug));
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const session = await getSessionFromRequest(request);
  const identifier = session ? `user:${session.sub}` : parsed.data.guestId && `guest:${parsed.data.guestId}`;
  if (!identifier) {
    return NextResponse.json({ error: 'Missing guestId' }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(listingPins)
    .where(
      and(eq(listingPins.listingId, listing.id), eq(listingPins.userIdOrSession, identifier)),
    );

  if (existing) {
    await db.delete(listingPins).where(eq(listingPins.id, existing.id));
    return NextResponse.json({ pinned: false });
  }

  await db.insert(listingPins).values({ listingId: listing.id, userIdOrSession: identifier });
  return NextResponse.json({ pinned: true });
}
