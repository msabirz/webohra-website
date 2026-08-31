import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings } from '@/db/schema';
import { adminListingModerationSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/listings/[id] — FR-14: flag, remove, or restore any
 * listing regardless of owner (the seller's own PATCH /api/listings/
 * [idOrSlug] only ever lets her toggle draft/active/archived on her own —
 * this is the moderation-authority version). moderationNote is required
 * when flagging or removing, so the seller sees why, not just that.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [listing] = await db.select().from(listings).where(eq(listings.id, Number(id)));
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminListingModerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(listings)
    .set({
      status: parsed.data.status,
      moderationNote:
        parsed.data.status === 'flagged' || parsed.data.status === 'removed'
          ? parsed.data.moderationNote
          : null,
    })
    .where(eq(listings.id, listing.id))
    .returning();

  return NextResponse.json({ listing: updated });
}
