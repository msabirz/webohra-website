import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { buyerAddresses } from '@/db/schema';
import { buyerAddressCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * /api/account/addresses — a logged-in buyer's saved addresses
 * (2026-09-06). Guest checkout is unaffected; there's no session to
 * attach a saved address to. Ordered default-first so the checkout
 * picker's first option is always the one she actually wants pre-picked.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to see your saved addresses' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const list = await db
    .select()
    .from(buyerAddresses)
    .where(eq(buyerAddresses.userId, userId))
    .orderBy(desc(buyerAddresses.isDefault), desc(buyerAddresses.createdAt));
  return NextResponse.json({ addresses: list });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to save an address' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = buyerAddressCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const userId = Number(session.sub);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(buyerAddresses)
    .where(eq(buyerAddresses.userId, userId));
  // Her very first address is always the default, regardless of what she
  // sent — there's never a real "no default" state once she has at least
  // one saved address.
  const makeDefault = count === 0 || parsed.data.isDefault === true;

  if (makeDefault) {
    await db
      .update(buyerAddresses)
      .set({ isDefault: false })
      .where(and(eq(buyerAddresses.userId, userId), eq(buyerAddresses.isDefault, true)));
  }

  const [address] = await db
    .insert(buyerAddresses)
    .values({ ...parsed.data, userId, isDefault: makeDefault })
    .returning();
  return NextResponse.json({ address }, { status: 201 });
}
