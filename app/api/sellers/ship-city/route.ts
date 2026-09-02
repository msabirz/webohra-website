import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerShipCities } from '@/db/schema';
import { sellerShipCityUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * PUT /api/sellers/ship-city — her self-managed-shipping city (planning
 * doc Decision 2: one city for now, modeled as its own table so a future
 * "let her add more cities" never needs a migration — this endpoint just
 * only ever keeps one row per seller today). Replaces whatever she had
 * before rather than adding a second row, since v1 has no UI for more
 * than one anyway.
 */
export async function PUT(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerShipCityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  await db.delete(sellerShipCities).where(eq(sellerShipCities.sellerId, sellerId));
  const [row] = await db.insert(sellerShipCities).values({ sellerId, city: parsed.data.city }).returning();

  return NextResponse.json({ shipCity: row.city });
}
