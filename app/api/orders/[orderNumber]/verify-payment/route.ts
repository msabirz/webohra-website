import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders } from '@/db/schema';
import { orderPaymentVerifySchema } from '@/lib/validation';
import { verifyRazorpayPaymentSignature } from '@/lib/razorpay';
import { confirmOrderPayment } from '@/lib/order-payment';

/**
 * POST /api/orders/[orderNumber]/verify-payment — the fast, browser-driven
 * confirmation right after Razorpay's checkout widget reports success
 * (Fulfillment & Subscriptions redesign, Phase 5b). Same guest-friendly
 * trust model as the rest of checkout — no session involved. Two checks
 * before the order is ever marked paid: the HMAC signature (proves this
 * order/payment pair is genuinely from Razorpay), and that the
 * razorpayOrderId given here matches the one already stored on THIS order
 * (proves the payment belongs to this specific order, not a valid payment
 * for some other order being replayed here). The webhook at
 * /api/webhooks/razorpay is the authoritative fallback if this call never
 * lands.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  const body = await request.json().catch(() => null);
  const parsed = orderPaymentVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (order.paymentMethod !== 'online' || !order.razorpayOrderId) {
    return NextResponse.json({ error: 'This order was not set up for online payment' }, { status: 400 });
  }
  if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return NextResponse.json({ error: 'This payment does not belong to this order' }, { status: 403 });
  }

  const signatureValid = verifyRazorpayPaymentSignature({
    orderId: parsed.data.razorpayOrderId,
    paymentId: parsed.data.razorpayPaymentId,
    signature: parsed.data.razorpaySignature,
  });
  if (!signatureValid) {
    return NextResponse.json({ error: 'Payment could not be verified' }, { status: 400 });
  }

  const result = await confirmOrderPayment({ orderNumber, gatewayPaymentId: parsed.data.razorpayPaymentId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ paymentStatus: 'paid' as const, alreadyConfirmed: result.alreadyConfirmed });
}
