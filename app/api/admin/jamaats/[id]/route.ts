import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { jamaats } from '@/db/schema';
import { adminJamaatUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [jamaat] = await db.select().from(jamaats).where(eq(jamaats.id, Number(id)));
  if (!jamaat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminJamaatUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(jamaats)
    .set(parsed.data)
    .where(eq(jamaats.id, jamaat.id))
    .returning();

  return NextResponse.json({ jamaat: updated });
}

/** Sellers reference a jamaat with onDelete: 'set null', so removing one
 *  here is safe — any seller pointed at it just falls back to no jamaat
 *  (self-managed shipping only) rather than the delete being blocked. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(jamaats).where(eq(jamaats.id, Number(id)));
  return NextResponse.json({ ok: true });
}
