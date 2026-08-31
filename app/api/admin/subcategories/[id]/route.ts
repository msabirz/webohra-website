import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subcategories } from '@/db/schema';
import { adminSubcategoryUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/** PATCH /api/admin/subcategories/[id] — rename, change listing type, or
 *  deactivate. Changing listingType only affects new listings going
 *  forward — existing listings under it keep whatever type they were
 *  created with (SRS never describes retroactively reclassifying them). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, Number(id)));
  if (!subcategory) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSubcategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(subcategories)
    .set(parsed.data)
    .where(eq(subcategories.id, subcategory.id))
    .returning();

  return NextResponse.json({ subcategory: updated });
}
