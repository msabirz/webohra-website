import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, users } from '@/db/schema';
import { bulkListingStatusUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * PATCH /api/listings/bulk-status
 *
 * Multi-select "Publish selected" / "Archive selected" / "Move to draft"
 * from the products table. Only ever touches the caller's own products —
 * ids that don't belong to her are silently dropped, not errored, since a
 * stale selection (another tab archived one mid-session) shouldn't block
 * the rest of the batch.
 */
export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkListingStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const { ids, status } = parsed.data;

  if (status === 'active') {
    const [seller] = await db.select().from(users).where(eq(users.id, sellerId));
    if (!seller?.itsVerified) {
      return NextResponse.json(
        { error: 'Your ITS ID needs to be verified by Admin before you can publish products' },
        { status: 403 },
      );
    }
  }

  const updated = await db
    .update(listings)
    .set({ status })
    .where(and(inArray(listings.id, ids), eq(listings.sellerId, sellerId)))
    .returning({ id: listings.id });

  return NextResponse.json({ updatedIds: updated.map((row) => row.id) });
}
