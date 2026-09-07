import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { subscriptionPurchaseVerifySchema } from '@/lib/validation';
import { verifyRazorpayPaymentSignature, fetchRazorpayOrder } from '@/lib/razorpay';
import { activateSubscriptionPurchase, type SellerType } from '@/lib/subscriptions';

/**
 * POST /api/sellers/subscriptions/verify — step two of buying a PAID
 * subscription plan, called by her browser right after Razorpay's
 * checkout widget reports success. Same two checks before anything
 * activates as /api/sellers/wallet/verify: the HMAC signature (proves
 * this order/payment pair is genuinely from Razorpay), and the order's
 * own notes.sellerId (proves this specific payment was created for the
 * seller now claiming it, not a replayed id belonging to someone else).
 * The webhook is the authoritative fallback if this call never lands.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscriptionPurchaseVerifySchema.safeParse(body);
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

  const sellerType = order.notes?.sellerType as SellerType | undefined;
  const planId = order.notes?.planId ? Number(order.notes.planId) : null;
  if (!sellerType || !planId) {
    return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 });
  }

  const result = await activateSubscriptionPurchase({
    sellerId,
    sellerType,
    planId,
    amountRupees: order.amount / 100,
    gatewayPaymentId: razorpayPaymentId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ renewsAt: result.renewsAt, alreadyProcessed: result.alreadyProcessed });
}
