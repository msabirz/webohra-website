import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerPayoutAccounts, users } from '@/db/schema';
import { sellerPayoutAccountSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { createRazorpayContact, createBankFundAccount } from '@/lib/razorpay-payouts';

/**
 * GET /api/sellers/payout-account — her current payout setup, masked
 * (displayLabel only — see seller_payout_accounts' own schema comment for
 * why a bank account's real number never lives here at all). Null if she
 * hasn't set one up yet, a real state to handle, not an error.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const [account] = await db
    .select({
      method: sellerPayoutAccounts.method,
      displayLabel: sellerPayoutAccounts.displayLabel,
      updatedAt: sellerPayoutAccounts.updatedAt,
    })
    .from(sellerPayoutAccounts)
    .where(eq(sellerPayoutAccounts.sellerId, Number(session.sub)));

  return NextResponse.json({ account: account ?? null });
}

/**
 * POST /api/sellers/payout-account — register or replace where her
 * online-order earnings go and how Admin actually pays her. Three
 * methods (see payoutMethodEnum's own comment for the full 2026-09-03
 * redesign — Admin pays directly through her own banking/UPI app rather
 * than RazorpayX Payouts moving the money):
 *   - 'upi': her VPA is stored directly (plain text — not comparably
 *     sensitive to a bank account number, and has to be real, readable
 *     text to build her payout QR code later).
 *   - 'bank_account': same as before — sent straight to a real RazorpayX
 *     contact + fund_account, only the opaque ids come back here, the
 *     raw account number/IFSC is never persisted in our own database.
 *   - 'qr_image': the already-uploaded (via /api/uploads/presign,
 *     purpose 'payout_qr') image URL is just stored directly.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerPayoutAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const [seller] = await db.select().from(users).where(eq(users.id, sellerId));
  if (!seller) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(sellerPayoutAccounts)
    .where(eq(sellerPayoutAccounts.sellerId, sellerId));

  try {
    let values: {
      sellerId: number;
      method: 'upi' | 'bank_account' | 'qr_image';
      upiVpa: string | null;
      razorpayContactId: string | null;
      razorpayFundAccountId: string | null;
      qrImageUrl: string | null;
      displayLabel: string;
      updatedAt: Date;
    };

    if (parsed.data.method === 'upi') {
      values = {
        sellerId,
        method: 'upi',
        upiVpa: parsed.data.vpa,
        razorpayContactId: null,
        razorpayFundAccountId: null,
        qrImageUrl: null,
        displayLabel: parsed.data.vpa,
        updatedAt: new Date(),
      };
    } else if (parsed.data.method === 'bank_account') {
      // Reuse her existing RazorpayX contact if she's changing her bank
      // details later — no reason to create a second contact for the
      // same seller.
      const contactId =
        existing?.razorpayContactId ??
        (
          await createRazorpayContact({
            name: seller.name ?? 'WE Bohra seller',
            email: seller.email ?? undefined,
            phone: seller.phone,
          })
        ).id;
      const result = await createBankFundAccount({
        contactId,
        accountHolderName: parsed.data.accountHolderName,
        ifsc: parsed.data.ifsc,
        accountNumber: parsed.data.accountNumber,
      });
      values = {
        sellerId,
        method: 'bank_account',
        upiVpa: null,
        razorpayContactId: contactId,
        razorpayFundAccountId: result.id,
        qrImageUrl: null,
        displayLabel: `${result.bankName ?? 'Bank account'} •••• ${result.lastFour}`,
        updatedAt: new Date(),
      };
    } else {
      values = {
        sellerId,
        method: 'qr_image',
        upiVpa: null,
        razorpayContactId: null,
        razorpayFundAccountId: null,
        qrImageUrl: parsed.data.qrImageUrl,
        displayLabel: 'QR code uploaded',
        updatedAt: new Date(),
      };
    }

    const [account] = existing
      ? await db
          .update(sellerPayoutAccounts)
          .set(values)
          .where(eq(sellerPayoutAccounts.id, existing.id))
          .returning()
      : await db.insert(sellerPayoutAccounts).values(values).returning();

    return NextResponse.json({
      account: { method: account.method, displayLabel: account.displayLabel, updatedAt: account.updatedAt },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save your payout details.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
