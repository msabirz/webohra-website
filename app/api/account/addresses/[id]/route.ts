import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { buyerAddresses } from '@/db/schema';
import { buyerAddressUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to edit your addresses' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(buyerAddresses)
    .where(and(eq(buyerAddresses.id, Number(id)), eq(buyerAddresses.userId, userId)));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = buyerAddressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (parsed.data.isDefault === true) {
    await db
      .update(buyerAddresses)
      .set({ isDefault: false })
      .where(and(eq(buyerAddresses.userId, userId), eq(buyerAddresses.isDefault, true)));
  }

  const [updated] = await db
    .update(buyerAddresses)
    .set(parsed.data)
    .where(eq(buyerAddresses.id, existing.id))
    .returning();
  return NextResponse.json({ address: updated });
}

/** If she deletes her default address, the oldest remaining one (if any)
 *  becomes the new default — same "never a real no-default state once
 *  she has at least one saved address" rule as creating the first one. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to delete an address' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(buyerAddresses)
    .where(and(eq(buyerAddresses.id, Number(id)), eq(buyerAddresses.userId, userId)));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(buyerAddresses).where(eq(buyerAddresses.id, existing.id));

  if (existing.isDefault) {
    const [nextDefault] = await db.select().from(buyerAddresses).where(eq(buyerAddresses.userId, userId)).limit(1);
    if (nextDefault) {
      await db.update(buyerAddresses).set({ isDefault: true }).where(eq(buyerAddresses.id, nextDefault.id));
    }
  }

  return NextResponse.json({ ok: true });
}
