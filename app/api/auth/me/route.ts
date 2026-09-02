import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, jamaats, sellerShipCities } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/** GET /api/auth/me — the logged-in user's own record, for the seller dashboard. */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const [profile] = await db
    .select({
      businessName: sellerProfiles.businessName,
      jamaatId: sellerProfiles.jamaatId,
      jamaatName: jamaats.name,
      jamaatCity: jamaats.city,
      // Fulfillment & Subscriptions redesign, Phase 2.
      addressLine1: sellerProfiles.addressLine1,
      addressLine2: sellerProfiles.addressLine2,
      city: sellerProfiles.city,
      state: sellerProfiles.state,
      pincode: sellerProfiles.pincode,
    })
    .from(sellerProfiles)
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(eq(sellerProfiles.userId, userId));

  // Decision 2 (planning doc): one self-ship city for now — this is the
  // whole reason it's modeled as its own table already, rather than a
  // column, even though only one row is ever read/written today.
  const [shipCity] = await db
    .select({ city: sellerShipCities.city })
    .from(sellerShipCities)
    .where(eq(sellerShipCities.sellerId, userId))
    .limit(1);

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      name: user.name,
      email: user.email,
      hasPassword: !!user.passwordHash,
      itsId: user.itsId,
      itsVerified: user.itsVerified,
      staffRole: user.staffRole,
    },
    sellerProfile: profile ?? null,
    sellerShipCity: shipCity?.city ?? null,
  });
}
