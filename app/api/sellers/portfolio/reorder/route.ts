import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { portfolioItems } from '@/db/schema';
import { portfolioReorderSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/** PATCH /api/sellers/portfolio/reorder — body: { order: number[] } —
 *  item ids in the new display order. Same shape as
 *  /api/listings/[idOrSlug]/images/reorder. */
export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = portfolioReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  await Promise.all(
    parsed.data.order.map((itemId, index) =>
      db
        .update(portfolioItems)
        .set({ sortOrder: index })
        .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.sellerId, sellerId))),
    ),
  );

  return NextResponse.json({ ok: true });
}
