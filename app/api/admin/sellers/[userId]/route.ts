import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, jamaats, listings, subcategories } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/** GET /api/admin/sellers/[userId] — full detail for one seller, including
 *  her products, for the Admin seller-detail view. */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;
  const id = Number(userId);

  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      itsId: users.itsId,
      itsVerified: users.itsVerified,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
      businessName: sellerProfiles.businessName,
      jamaatId: sellerProfiles.jamaatId,
      jamaatCity: jamaats.city,
      jamaatName: jamaats.name,
    })
    .from(sellerProfiles)
    .innerJoin(users, eq(sellerProfiles.userId, users.id))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(eq(users.id, id));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sellerListings = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      status: listings.status,
      subcategoryName: subcategories.name,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .where(eq(listings.sellerId, id))
    .orderBy(desc(listings.createdAt));

  return NextResponse.json({ seller: row, listings: sellerListings });
}
