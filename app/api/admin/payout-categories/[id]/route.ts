import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { payoutCategories } from '@/db/schema';
import { adminPayoutCategoryUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * `key` is deliberately not editable here — it's the stable value any
 * code checking for 'regular_settlement' relies on. Rename via `name`
 * instead; retire via `active: false`, same as webohra-offices.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [category] = await db.select().from(payoutCategories).where(eq(payoutCategories.id, Number(id)));
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminPayoutCategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(payoutCategories)
    .set(parsed.data)
    .where(eq(payoutCategories.id, category.id))
    .returning();

  return NextResponse.json({ category: updated });
}
