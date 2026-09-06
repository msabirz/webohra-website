import { NextResponse } from 'next/server';
import { db } from '@/db/index';
import { subscriptionSettings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { walletTopupOrderSchema } from '@/lib/validation';
import { createRazorpayOrder, getRazorpayKeyId } from '@/lib/razorpay';
import { generateWalletTopupReceipt } from '@/lib/ids';

/**
 * POST /api/sellers/wallet/topup-order — step one of a wallet top-up:
 * creates a real Razorpay order (sandbox/test-mode keys today) and hands
 * back what the frontend Checkout widget needs to open. No money moves and
 * no wallet_transactions row exists yet — that only ever happens once a
 * real signed payment comes back, via /verify or the webhook. sellerId is
 * stamped into the order's own `notes` here specifically so the webhook
 * (which has no session, no request from her browser at all) still knows
 * whose wallet to credit.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = walletTopupOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // The real minimum lives in subscriptionSettings, admin-editable — not a
  // static number in the Zod schema above (that only guards against a
  // nonsense amount). ₹500 as of 2026-09-06, but this reads whatever's
  // actually configured, so an admin change takes effect immediately.
  const [settings] = await db.select().from(subscriptionSettings).limit(1);
  const minTopup = settings ? Number(settings.walletMinTopup) : 500;
  if (parsed.data.amountRupees < minTopup) {
    return NextResponse.json(
      { error: `Minimum top-up is ₹${minTopup.toLocaleString('en-IN')}` },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const order = await createRazorpayOrder({
    amountRupees: parsed.data.amountRupees,
    receipt: generateWalletTopupReceipt(),
    notes: { sellerId: String(sellerId), purpose: 'wallet_topup' },
  });

  return NextResponse.json({
    razorpayOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: getRazorpayKeyId(),
  });
}
