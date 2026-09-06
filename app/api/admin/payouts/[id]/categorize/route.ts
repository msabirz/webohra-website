import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts } from '@/db/schema';
import { adminPayoutCategorizeSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/payouts/[id]/categorize — re-tags an existing payout's
 * category, independent of its status. A regular payout is stamped
 * 'regular_settlement' automatically at creation (lib/payouts.ts); this
 * is how admin flags one as something else — e.g. a held amount released
 * manually after a dispute, tagged 'miscellaneous' — for real reporting,
 * not a free-text guess buried in manualNote.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, Number(id)));
  if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminPayoutCategorizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(payouts)
    .set({ categoryId: parsed.data.categoryId })
    .where(eq(payouts.id, payout.id))
    .returning();

  return NextResponse.json({ payout: updated });
}
