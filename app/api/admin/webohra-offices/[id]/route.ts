import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { webohraOffices } from '@/db/schema';
import { adminWebohraOfficeUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [office] = await db.select().from(webohraOffices).where(eq(webohraOffices.id, Number(id)));
  if (!office) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminWebohraOfficeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // '' from the update schema's optional-or-empty-string fields means
  // "clear it" — translate to null rather than storing a literal blank.
  const { addressLine2, contactPhone, ...rest } = parsed.data;
  const [updated] = await db
    .update(webohraOffices)
    .set({
      ...rest,
      ...(addressLine2 !== undefined && { addressLine2: addressLine2 || null }),
      ...(contactPhone !== undefined && { contactPhone: contactPhone || null }),
    })
    .where(eq(webohraOffices.id, office.id))
    .returning();

  return NextResponse.json({ office: updated });
}

/** jamaats.officeId is onDelete: 'set null', so removing an office here is
 *  safe — any jamaat pointed at it just loses its office mapping rather
 *  than the delete being blocked. Archiving (active: false) is the usual
 *  path; this is for a genuine mistake, not routine retirement. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(webohraOffices).where(eq(webohraOffices.id, Number(id)));
  return NextResponse.json({ ok: true });
}
