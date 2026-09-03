import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerPayoutAccounts, users, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { getBankFundAccountDetails } from '@/lib/razorpay-payouts';

/**
 * GET /api/admin/sellers/[userId]/payout-method — the REAL, usable payout
 * details for one seller, unlike GET /api/sellers/payout-account (which
 * only ever returns her own masked summary). This is what Admin actually
 * pays against: her UPI VPA (to build a payout QR code — see
 * lib/upi-qr.ts), her bank account fetched live from Razorpay (never
 * stored in our own database — see seller_payout_accounts' own schema
 * comment), or her uploaded QR image. isAdmin, not isStaff — same
 * "real-money-adjacent action gets the stricter role" reasoning as the
 * rest of the payout endpoints, even though this one only reads.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;
  const sellerId = Number(userId);
  if (!Number.isInteger(sellerId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [account] = await db
    .select()
    .from(sellerPayoutAccounts)
    .where(eq(sellerPayoutAccounts.sellerId, sellerId));
  if (!account) {
    return NextResponse.json({ account: null });
  }

  const [sellerRow] = await db
    .select({ name: users.name, businessName: sellerProfiles.businessName })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(eq(users.id, sellerId));
  const payeeName = sellerRow?.businessName ?? sellerRow?.name ?? 'WE Bohra seller';

  if (account.method === 'upi') {
    return NextResponse.json({
      account: { method: 'upi', payeeName, upi: { vpa: account.upiVpa } },
    });
  }

  if (account.method === 'qr_image') {
    return NextResponse.json({
      account: { method: 'qr_image', payeeName, qrImageUrl: account.qrImageUrl },
    });
  }

  // 'bank_account' — fetched live, never persisted here.
  if (!account.razorpayFundAccountId) {
    return NextResponse.json({ error: 'This seller\'s bank details are missing — ask her to re-register them.' }, { status: 500 });
  }
  try {
    const bank = await getBankFundAccountDetails(account.razorpayFundAccountId);
    return NextResponse.json({
      account: {
        method: 'bank_account',
        payeeName,
        bank: {
          accountHolderName: bank.accountHolderName,
          accountNumber: bank.accountNumber,
          ifsc: bank.ifsc,
          bankName: bank.bankName,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not fetch this seller\'s bank details.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
