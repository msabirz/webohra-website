import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { categories } from '@/db/schema';
import { adminCategoryUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/categories/[id] — rename or deactivate (FR-12 says
 * "deactivate", not "delete" — a category's existing listings/history stay
 * intact; it just stops appearing for browsing or new listing creation).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [category] = await db.select().from(categories).where(eq(categories.id, Number(id)));
  if (!category) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminCategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(categories)
    .set(parsed.data)
    .where(eq(categories.id, category.id))
    .returning();

  return NextResponse.json({ category: updated });
}
