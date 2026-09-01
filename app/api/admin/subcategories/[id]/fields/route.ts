import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subcategories, subcategoryFields } from '@/db/schema';
import { adminSubcategoryFieldCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { slugifyTitle } from '@/lib/ids';

/**
 * GET/POST /api/admin/subcategories/[id]/fields — FR-17's actual
 * implementation: the admin-configurable listing schema per subcategory.
 * GET is admin-only here (the public shape lives on GET /api/categories,
 * bundled per subcategory for the seller form) — this route is for the
 * field-builder UI itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(_request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const fields = await db
    .select()
    .from(subcategoryFields)
    .where(eq(subcategoryFields.subcategoryId, Number(id)))
    .orderBy(asc(subcategoryFields.sortOrder));

  return NextResponse.json({ fields });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const subcategoryId = Number(id);
  const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, subcategoryId));
  if (!subcategory) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSubcategoryFieldCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // fieldKey is derived once, at creation, and never changes again — see
  // the column's own comment in db/schema.ts for why (existing
  // listing_field_values rows key off it).
  const existing = await db
    .select({ fieldKey: subcategoryFields.fieldKey, sortOrder: subcategoryFields.sortOrder })
    .from(subcategoryFields)
    .where(eq(subcategoryFields.subcategoryId, subcategoryId));
  const baseKey = slugifyTitle(parsed.data.label);
  const takenKeys = new Set(existing.map((f) => f.fieldKey));
  let fieldKey = baseKey;
  let suffix = 2;
  while (takenKeys.has(fieldKey)) {
    fieldKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }
  const nextSortOrder = existing.reduce((max, f) => Math.max(max, f.sortOrder), -1) + 1;

  const [field] = await db
    .insert(subcategoryFields)
    .values({
      subcategoryId,
      label: parsed.data.label,
      fieldKey,
      fieldType: parsed.data.fieldType,
      required: parsed.data.required,
      options: parsed.data.options ?? null,
      sortOrder: nextSortOrder,
    })
    .returning();

  return NextResponse.json({ field }, { status: 201 });
}
