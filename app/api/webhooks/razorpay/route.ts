import { NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import { creditWalletTopup } from '@/lib/wallet';

/**
 * POST /api/webhooks/razorpay — Razorpay's own server calling us directly,
 * no seller session involved. This is the authoritative crediting path:
 * /api/sellers/wallet/verify is the fast, browser-driven happy path, but a
 * closed tab or a lost connection right after payment would otherwise leave
 * her charged with nothing to show for it. Configured in the Razorpay
 * dashboard for `order.paid` and `payment.failed` only (the two events this
 * session's setup selected) — anything else Razorpay sends here is
 * acknowledged and ignored rather than erroring, since webhook config in
 * the dashboard can outpace what this handler currently knows how to do.
 *
 * Must read the raw body text before any JSON parsing — the signature is
 * computed over the exact bytes Razorpay sent, and re-serializing parsed
 * JSON would produce different bytes and always fail to verify.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(rawBody || '{}');

  if (event.event === 'order.paid') {
    const orderEntity = event.payload?.order?.entity;
    const paymentEntity = event.payload?.payment?.entity;
    const sellerId = orderEntity?.notes?.sellerId ? Number(orderEntity.notes.sellerId) : null;
    const purpose = orderEntity?.notes?.purpose;

    // Only wallet top-ups are wired up in this phase — a future Razorpay
    // order created for something else (buyer checkout, once that lands)
    // would also fire order.paid here and must not be mistaken for one.
    if (purpose === 'wallet_topup' && sellerId && paymentEntity?.id) {
      await creditWalletTopup({
        sellerId,
        amountRupees: (paymentEntity.amount ?? orderEntity.amount) / 100,
        gatewayPaymentId: paymentEntity.id,
      });
    }
  } else if (event.event === 'payment.failed') {
    // No wallet_transactions row — nothing here ever moved a real rupee, and
    // that table's whole point is that every row is a real balance change
    // (see its own comment). Logged for visibility only.
    console.log(
      `[razorpay-webhook] payment.failed: ${event.payload?.payment?.entity?.id ?? 'unknown'} — ${event.payload?.payment?.entity?.error_description ?? 'no reason given'}`,
    );
  }

  return NextResponse.json({ ok: true });
}
