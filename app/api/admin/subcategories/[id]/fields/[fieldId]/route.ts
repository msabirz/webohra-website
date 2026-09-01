import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subcategoryFields } from '@/db/schema';
import { adminSubcategoryFieldUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/subcategories/[id]/fields/[fieldId]
 *
 * Covers everything an admin can change about an existing field — label,
 * required, options, and active (archive/restore). There is deliberately
 * no DELETE here: a hard delete cascades to listing_field_values and would
 * silently erase every existing listing's already-collected answer for
 * that field. "Removing" a field means setting active: false instead —
 * same archived-not-deleted pattern as categories.active/
 * subcategories.active — which stops it being offered on new/edited
 * listings while leaving what was already collected intact and still
 * shown wherever that listing displays it.
 *
 * fieldType is also deliberately not editable: changing a live field's
 * type after listings already have values stored against it (e.g.
 * select -> number) would leave those old values uninterpretable. An admin
 * who needs a different type archives this one and creates a new one.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, fieldId } = await params;
  const [field] = await db
    .select()
    .from(subcategoryFields)
    .where(eq(subcategoryFields.id, Number(fieldId)));
  if (!field || field.subcategoryId !== Number(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSubcategoryFieldUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(subcategoryFields)
    .set(parsed.data)
    .where(eq(subcategoryFields.id, field.id))
    .returning();

  return NextResponse.json({ field: updated });
}
