import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, payouts, refunds } from '@/db/schema';
import { createRazorpayRefund } from '@/lib/razorpay';
import { computeOrderTotalRupees } from '@/lib/order-total';
import { flagSellerRecoveryDispute } from '@/lib/disputes';

/**
 * The sum of every 'processed' refund row for an order — the real source
 * of truth for how much has actually gone back, since orders.paymentStatus
 * only ever collapses to a single 'paid'/'refunded' value (see its own
 * schema comment). A 'processing'/'failed' row never counts here.
 */
export async function getRefundedAmount(orderId: number): Promise<number> {
  const rows = await db
    .select({ amount: refunds.amount })
    .from(refunds)
    .where(and(eq(refunds.orderId, orderId), eq(refunds.status, 'processed')));
  return rows.reduce((sum, r) => sum + Number(r.amount), 0);
}

/**
 * A plain-language warning for the admin refund screen when this order's
 * seller(s) have already been paid out — user's own call (2026-09-03): no
 * automatic clawback, just make sure Admin sees it before she confirms.
 * Null when nothing's been paid out yet, a real state (not every order has
 * reached that point), not an absence of a warning worth showing.
 */
export async function getOrderPayoutWarning(orderId: number): Promise<string | null> {
  const rows = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.orderId, orderId), eq(payouts.status, 'processed')));
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, p) => sum + Number(p.netAmount), 0);
  const who = rows.length === 1 ? 'the seller' : `${rows.length} sellers`;
  return `₹${total.toLocaleString('en-IN')} has already been paid out to ${who} for this order — refunding here does not automatically claw that back. You'll need to recover it from ${rows.length === 1 ? 'her' : 'them'} yourself.`;
}

export type RefundOrderResult = { ok: true; refund: typeof refunds.$inferSelect } | { ok: false; error: string };

/**
 * Issues a real refund against an order's payment — Admin Panel
 * transaction/dispute/refund tooling, 2026-09-03. isAdmin-only at the
 * route level (see app/api/admin/orders/[orderNumber]/refund), same
 * "real-money action gets the stricter role" reasoning as payouts. Never
 * throws: a Razorpay-side failure is recorded as a real 'failed' refund
 * row with a reason, not an unhandled exception — same shape as
 * lib/payouts.ts's sendPayout.
 */
export async function refundOrder(
  orderId: number,
  staffId: number,
  amountRupees: number,
  reason: string,
): Promise<RefundOrderResult> {
  if (amountRupees <= 0) return { ok: false, error: 'Refund amount must be greater than zero.' };

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.paymentMethod !== 'online') {
    return { ok: false, error: 'Only online-paid orders can be refunded here — there is no Razorpay payment to refund on a COD order.' };
  }
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded') {
    return { ok: false, error: `This order's payment status is '${order.paymentStatus ?? 'pending'}' — only a paid order can be refunded.` };
  }
  if (!order.razorpayPaymentId) {
    return { ok: false, error: 'This order has no Razorpay payment on record.' };
  }

  const [total, alreadyRefunded] = await Promise.all([
    computeOrderTotalRupees(orderId),
    getRefundedAmount(orderId),
  ]);
  const remaining = total - alreadyRefunded;
  if (amountRupees > remaining + 0.01) {
    return {
      ok: false,
      error: `Only ₹${remaining.toLocaleString('en-IN')} is left to refund on this order (₹${alreadyRefunded.toLocaleString('en-IN')} already refunded of ₹${total.toLocaleString('en-IN')} paid).`,
    };
  }

  // Recorded 'processing' first so a slow/crashed request never silently
  // vanishes — same "claim the row before the real call" shape as
  // lib/payouts.ts's sendPayout, just insert-first instead of update-first
  // since a refund has no earlier row to claim.
  const [pending] = await db
    .insert(refunds)
    .values({
      orderId,
      amount: amountRupees.toFixed(2),
      reason,
      status: 'processing',
      initiatedByStaffId: staffId,
    })
    .returning();

  try {
    const result = await createRazorpayRefund({
      paymentId: order.razorpayPaymentId,
      amountRupees,
      reason,
    });
    const [updated] = await db
      .update(refunds)
      .set({
        status: result.status === 'processed' ? 'processed' : 'processing',
        razorpayRefundId: result.id,
        processedAt: new Date(),
      })
      .where(eq(refunds.id, pending.id))
      .returning();

    const newTotalRefunded = alreadyRefunded + amountRupees;
    if (newTotalRefunded >= total - 0.01) {
      await db.update(orders).set({ paymentStatus: 'refunded' }).where(eq(orders.id, orderId));
    }

    // User's own follow-up call (2026-09-03): no automatic money movement
    // against the seller, but a refund landing on an order she's already
    // been paid out for must never just quietly happen — auto-flag it as
    // a trackable dispute so recovering it from her doesn't depend on
    // anyone remembering a one-time warning banner.
    const payoutWarning = await getOrderPayoutWarning(orderId);
    if (payoutWarning) {
      await flagSellerRecoveryDispute(
        orderId,
        staffId,
        `Auto-flagged: a refund of ₹${amountRupees.toLocaleString('en-IN')} was issued to the buyer after the seller had already been paid out for this order. ${payoutWarning}`,
      );
    }

    return { ok: true, refund: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund failed for an unknown reason';
    await db
      .update(refunds)
      .set({ status: 'failed', failureReason: message.slice(0, 300) })
      .where(eq(refunds.id, pending.id));
    return { ok: false, error: message };
  }
}
