import { NextResponse } from 'next/server';
import { desc, eq, ilike, or, and } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerWallets, users, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/wallets — every seller who has a wallet (Fulfillment &
 * Subscriptions redesign, Phase 5), for Admin/Customer Support oversight
 * and as the "pick a seller" list behind /admin/wallets/[sellerId]. Only
 * sellers who've actually opted into recharge or topped up show up here —
 * a plan-billed seller has no wallet row at all, and would just be a dead
 * end (zero transactions) if listed. ?q searches business name, name,
 * email, or phone, same convention as /api/admin/sellers.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q');

  const conditions = [];
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
      sellerId: sellerWallets.sellerId,
      balance: sellerWallets.balance,
      walletCreatedAt: sellerWallets.createdAt,
      name: users.name,
      email: users.email,
      phone: users.phone,
      businessName: sellerProfiles.businessName,
    })
    .from(sellerWallets)
    .innerJoin(users, eq(sellerWallets.sellerId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sellerWallets.balance));

  return NextResponse.json({ wallets: rows });
}
