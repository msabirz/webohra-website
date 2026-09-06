import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { wishlistItems } from '@/db/schema';
import { wishlistAddSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * /api/account/wishlist — a logged-in buyer's saved listings
 * (2026-09-06). Returns bare listingIds only, newest-saved first — the
 * buyer-facing pages fetch each listing's real detail themselves (same
 * per-id fetch pattern the cart/checkout already uses), rather than this
 * route duplicating the listings feed's own contact-mode/pricing
 * resolution logic just to embed it here too.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to see your saved listings' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const rows = await db
    .select({ listingId: wishlistItems.listingId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));
  return NextResponse.json({ listingIds: rows.map((r) => r.listingId) });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to save a listing' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = wishlistAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const userId = Number(session.sub);
  // Idempotent on the unique(userId, listingId) constraint — an
  // already-saved heart firing this again is a no-op, not an error, since
  // the button's own local state can't always guarantee it hasn't
  // double-fired.
  await db
    .insert(wishlistItems)
    .values({ userId, listingId: parsed.data.listingId })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true }, { status: 201 });
}
