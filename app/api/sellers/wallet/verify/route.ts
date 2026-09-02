import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { walletTopupVerifySchema } from '@/lib/validation';
import { verifyRazorpayPaymentSignature, fetchRazorpayOrder } from '@/lib/razorpay';
import { creditWalletTopup } from '@/lib/wallet';

/**
 * POST /api/sellers/wallet/verify — step two of a wallet top-up, called by
 * her browser right after Razorpay's checkout widget reports success. Two
 * separate checks before a single rupee is credited: the HMAC signature
 * (proves this order/payment pair is genuinely from Razorpay, not made up),
 * and the order's own notes.sellerId (proves this specific payment was
 * created for the seller who's now claiming it — the signature alone
 * doesn't establish that; without this a valid completed payment id
 * belonging to someone else could otherwise be replayed here to steal the
 * credit, if it ever leaked). The webhook below is the authoritative
 * fallback if this call never lands (closed tab, lost connection); either
 * one alone is enough to get her credited.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = walletTopupVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const signatureValid = verifyRazorpayPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });
  if (!signatureValid) {
    return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 });
  }

  const order = await fetchRazorpayOrder(razorpayOrderId);
  const orderSellerId = order.notes?.sellerId ? Number(order.notes.sellerId) : null;
  const sellerId = Number(session.sub);
  if (orderSellerId !== sellerId) {
    return NextResponse.json({ error: 'This payment does not belong to your account' }, { status: 403 });
  }

  const result = await creditWalletTopup({
    sellerId,
    amountRupees: order.amount / 100,
    gatewayPaymentId: razorpayPaymentId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ balance: result.balance, alreadyCredited: result.alreadyCredited });
}
