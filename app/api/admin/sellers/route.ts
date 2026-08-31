import { NextResponse } from 'next/server';
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, jamaats, listings } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/sellers — every seller account, for FR-13's verification
 * review queue and general oversight. ?verified=pending|verified filters
 * the ITS status; ?q searches business name, name, email, or phone.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const verified = url.searchParams.get('verified');
  const q = url.searchParams.get('q');

  const conditions = [];
  if (verified === 'pending') conditions.push(eq(users.itsVerified, false));
  if (verified === 'verified') conditions.push(eq(users.itsVerified, true));
  if (q) {
    conditions.push(
      or(
        ilike(sellerProfiles.businessName, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
        ilike(users.phone, `%${q}%`),
      ),
    );
  }

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      itsId: users.itsId,
      itsVerified: users.itsVerified,
      createdAt: users.createdAt,
      businessName: sellerProfiles.businessName,
      jamaatCity: jamaats.city,
      jamaatName: jamaats.name,
    })
    .from(sellerProfiles)
    .innerJoin(users, eq(sellerProfiles.userId, users.id))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt));

  const sellerIds = rows.map((row) => row.userId);
  const listingCounts = sellerIds.length
    ? await db
        .select({ sellerId: listings.sellerId, count: count() })
        .from(listings)
        .where(inArray(listings.sellerId, sellerIds))
        .groupBy(listings.sellerId)
    : [];
  const countBySellerId = new Map(listingCounts.map((row) => [row.sellerId, row.count]));

  return NextResponse.json({
    sellers: rows.map((row) => ({ ...row, listingCount: countBySellerId.get(row.userId) ?? 0 })),
  });
}
