import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings } from '@/db/schema';
import { bulkListingDeleteSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/listings/bulk-delete
 *
 * Multi-select "Delete selected" from the products table. Products with
 * order history are silently skipped (order_items references listings with
 * onDelete: 'restrict') rather than failing the whole batch — the response
 * reports which ids actually got deleted so the UI can explain the rest.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkListingDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const ownRows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(inArray(listings.id, parsed.data.ids), eq(listings.sellerId, sellerId)));

  const deletedIds: number[] = [];
  const blockedIds: number[] = [];
  for (const row of ownRows) {
    try {
      await db.delete(listings).where(eq(listings.id, row.id));
      deletedIds.push(row.id);
    } catch {
      blockedIds.push(row.id);
    }
  }

  return NextResponse.json({ deletedIds, blockedIds });
}
