import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subcategoryFields } from '@/db/schema';
import { adminSubcategoryFieldReorderSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/** PATCH /api/admin/subcategories/[id]/fields/reorder — body: { order: number[] }
 *  (field ids, in the new display order). Same shape as the seller's own
 *  image-reorder endpoint. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const subcategoryId = Number(id);
  const body = await request.json().catch(() => null);
  const parsed = adminSubcategoryFieldReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await Promise.all(
    parsed.data.order.map((fieldId, index) =>
      db
        .update(subcategoryFields)
        .set({ sortOrder: index })
        .where(and(eq(subcategoryFields.id, fieldId), eq(subcategoryFields.subcategoryId, subcategoryId))),
    ),
  );

  return NextResponse.json({ ok: true });
}
