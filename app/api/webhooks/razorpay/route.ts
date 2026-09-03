import { NextResponse } from 'next/server';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay';
import { creditWalletTopup } from '@/lib/wallet';
import { confirmOrderPayment, markOrderPaymentFailed } from '@/lib/order-payment';
import { markRefundProcessed, markRefundFailed } from '@/lib/refunds';

/**
 * POST /api/webhooks/razorpay — Razorpay's own server calling us directly,
 * no session involved. This is the authoritative crediting/confirming
 * path for both real-money flows on this platform — a closed tab or a
 * lost connection right after payment would otherwise leave her charged
 * with nothing to show for it:
 *   - wallet_topup (Phase 5a) — /api/sellers/wallet/verify is the fast,
 *     browser-driven happy path; this is the fallback.
 *   - order_payment (Phase 5b) — /api/orders/[orderNumber]/verify-payment
 *     is that same fast path for a buyer's checkout order.
 * Every Razorpay order this platform creates stamps `notes.purpose` at
 * creation time specifically so this one handler can tell which of the two
 * a given event is about — see createRazorpayOrder's callers.
 *
 * Configured in the Razorpay dashboard for `order.paid` and
 * `payment.failed` (this session's original setup) — `refund.processed`
 * and `refund.failed` (Admin Panel transaction/dispute/refund tooling,
 * 2026-09-03, see lib/refunds.ts's markRefundProcessed/markRefundFailed)
 * are handled here too but need the SAME dashboard enabling before they'll
 * actually arrive — check Settings → Webhooks in the Razorpay dashboard
 * and add those two event types alongside the original two if they aren't
 * already selected. Anything else Razorpay sends here is acknowledged and
 * ignored rather than erroring, since webhook config in the dashboard can
 * outpace what this handler currently knows how to do.
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
    const purpose = orderEntity?.notes?.purpose;

    if (purpose === 'wallet_topup') {
      const sellerId = orderEntity?.notes?.sellerId ? Number(orderEntity.notes.sellerId) : null;
      if (sellerId && paymentEntity?.id) {
        await creditWalletTopup({
          sellerId,
          amountRupees: (paymentEntity.amount ?? orderEntity.amount) / 100,
          gatewayPaymentId: paymentEntity.id,
        });
      }
    } else if (purpose === 'order_payment') {
      const orderNumber = orderEntity?.notes?.orderNumber;
      if (orderNumber && paymentEntity?.id) {
        await confirmOrderPayment({ orderNumber, gatewayPaymentId: paymentEntity.id });
      }
    }
  } else if (event.event === 'payment.failed') {
    const paymentEntity = event.payload?.payment?.entity;
    // No wallet_transactions row for a failed top-up — nothing here ever
    // moved a real rupee, and that table's whole point is that every row
    // is a real balance change (see its own comment). A failed order
    // payment DOES get a real state change, though — she needs a
    // non-'pending' status to see "try again" instead of an eternal
    // ambiguous wait.
    if (paymentEntity?.notes?.purpose === 'order_payment' && paymentEntity.notes.orderNumber) {
      await markOrderPaymentFailed(paymentEntity.notes.orderNumber);
    }
    console.log(
      `[razorpay-webhook] payment.failed: ${paymentEntity?.id ?? 'unknown'} — ${paymentEntity?.error_description ?? 'no reason given'}`,
    );
  } else if (event.event === 'refund.processed') {
    const refundEntity = event.payload?.refund?.entity;
    if (refundEntity?.id) {
      await markRefundProcessed(refundEntity.id);
    }
  } else if (event.event === 'refund.failed') {
    const refundEntity = event.payload?.refund?.entity;
    if (refundEntity?.id) {
      await markRefundFailed(refundEntity.id, 'Refund failed on Razorpay\'s side after being created — check the Razorpay dashboard for the exact reason.');
    }
  }

  return NextResponse.json({ ok: true });
}
