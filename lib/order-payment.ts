import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders } from '@/db/schema';

/**
 * Confirms a real Razorpay payment against an order — the one place an
 * order's paymentStatus ever becomes 'paid'. Called from both the
 * client-side verify endpoint (fast path, right after her browser gets
 * Razorpay's success callback) and the webhook handler (authoritative
 * fallback, in case she closes the tab before the verify call lands) — same
 * dual-path shape as lib/wallet.ts's creditWalletTopup, for the same reason.
 *
 * Race-safety here doesn't need db.batch the way the wallet does — there's
 * no separate audit-trail row to keep atomic with this, just the order's
 * own status flipping once. The `WHERE payment_status != 'paid'` guard
 * (not just `= 'pending'` — a retried order can arrive here from 'failed'
 * too) is what makes a second, redundant call (webhook arriving after
 * verify already landed, or vice versa) a safe no-op: only the first
 * caller's UPDATE actually matches a row.
 */
export async function confirmOrderPayment(params: {
  orderNumber: string;
  gatewayPaymentId: string;
}): Promise<{ ok: true; alreadyConfirmed: boolean } | { ok: false; error: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, params.orderNumber));
  if (!order) return { ok: false, error: 'Order not found' };

  if (order.paymentStatus === 'paid') {
    // Already confirmed (by the other path) — safe no-op, not an error.
    // Only treat it as a real conflict if it's a genuinely different
    // payment somehow landing here, which the unique constraint on
    // razorpay_payment_id would have already refused at the DB level
    // before this function is ever called with mismatched ids.
    return { ok: true, alreadyConfirmed: true };
  }

  const [updated] = await db
    .update(orders)
    .set({ paymentStatus: 'paid', razorpayPaymentId: params.gatewayPaymentId })
    .where(and(eq(orders.id, order.id), ne(orders.paymentStatus, 'paid')))
    .returning();

  return { ok: true, alreadyConfirmed: !updated };
}

/**
 * Marks a payment attempt failed — buyer-facing "try again" state, not a
 * dead end. Only ever moves pending -> failed; never overwrites an
 * already-paid order (an out-of-order webhook arriving after a successful
 * payment was already confirmed some other way should never regress it).
 */
export async function markOrderPaymentFailed(orderNumber: string): Promise<void> {
  await db
    .update(orders)
    .set({ paymentStatus: 'failed' })
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.paymentStatus, 'pending')));
}
