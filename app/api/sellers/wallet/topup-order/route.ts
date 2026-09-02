import { NextResponse } from 'next/server';
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
