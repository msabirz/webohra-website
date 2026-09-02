import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { getWalletWithHistory } from '@/lib/wallet';

/**
 * GET /api/admin/wallets/[sellerId] — one seller's wallet balance and full
 * transaction history, for Admin/Customer Support to look into a specific
 * seller (a support query, a dispute, or just checking before approving a
 * manual adjustment). Higher limit than her own /api/sellers/wallet view —
 * 200 instead of 50 — since Admin looking into a dispute is exactly the
 * case where the recent-only cap would get in the way.
 */
export async function GET(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sellerId = Number((await params).sellerId);
  if (!Number.isInteger(sellerId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [seller] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      businessName: sellerProfiles.businessName,
    })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(eq(users.id, sellerId));
  if (!seller) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { wallet, transactions } = await getWalletWithHistory(sellerId, 200);
  return NextResponse.json({ seller, wallet, transactions });
}
