import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerPayoutAccounts, users } from '@/db/schema';
import { sellerPayoutAccountSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { createRazorpayContact, createBankFundAccount, createUpiFundAccount } from '@/lib/razorpay-payouts';

/**
 * GET /api/sellers/payout-account — her current payout setup, masked
 * (displayLabel only — the real account number/VPA lives only in
 * RazorpayX from the moment she submits it, never here — see
 * seller_payout_accounts' own schema comment). Null if she hasn't set one
 * up yet, a real state to handle, not an error.
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
 * online-order earnings go. Creates a real RazorpayX contact (once — reused
 * on any later change) and a real fund account (bank account or UPI), then
 * stores only the resulting opaque ids + a masked label. Her raw account
 * number/VPA passes through this route in the request body but is never
 * persisted here — it's sent straight to Razorpay and discarded once the
 * fund_account response comes back.
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
    // Reuse her existing RazorpayX contact if she's changing her payout
    // method/account later — no reason to create a second contact for the
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

    let fundAccountId: string;
    let displayLabel: string;
    if (parsed.data.method === 'bank_account') {
      const result = await createBankFundAccount({
        contactId,
        accountHolderName: parsed.data.accountHolderName,
        ifsc: parsed.data.ifsc,
        accountNumber: parsed.data.accountNumber,
      });
      fundAccountId = result.id;
      displayLabel = `${result.bankName ?? 'Bank account'} •••• ${result.lastFour}`;
    } else {
      const result = await createUpiFundAccount({ contactId, vpa: parsed.data.vpa });
      fundAccountId = result.id;
      displayLabel = result.vpa;
    }

    const values = {
      sellerId,
      method: parsed.data.method,
      razorpayContactId: contactId,
      razorpayFundAccountId: fundAccountId,
      displayLabel,
      updatedAt: new Date(),
    };

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
