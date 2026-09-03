import { and, eq, inArray } from 'drizzle-orm';
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
 *
 * `sellerIds`, when given, scopes the check to just those sellers — used by
 * lib/order-cancellation.ts's cancelOrderItems, which only ever refunds the
 * specific seller(s) whose items got cancelled, never the whole order.
 * Without it (the plain "Refund buyer" button, which refunds against the
 * order as a whole with no particular seller in mind), every seller with a
 * processed payout on this order counts.
 */
export async function getOrderPayoutWarning(orderId: number, sellerIds?: number[]): Promise<string | null> {
  const conditions = [eq(payouts.orderId, orderId), eq(payouts.status, 'processed')];
  if (sellerIds) conditions.push(inArray(payouts.sellerId, sellerIds));
  const rows = await db.select().from(payouts).where(and(...conditions));
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
 *
 * `sellerIdsForWarning`, when given, scopes the payout-already-sent check
 * (and the auto-dispute it can flag) to just those sellers — see
 * getOrderPayoutWarning's own comment. Omitted by the plain "Refund buyer"
 * action (order-wide); passed by lib/order-cancellation.ts's
 * cancelOrderItems (specific seller(s) whose items were actually
 * cancelled).
 */
export async function refundOrder(
  orderId: number,
  staffId: number,
  amountRupees: number,
  reason: string,
  sellerIdsForWarning?: number[],
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
    // Razorpay sometimes settles a refund synchronously (status comes back
    // 'processed' immediately) and sometimes asynchronously (comes back
    // 'processing', genuinely completes moments to hours later) — the
    // latter is only ever confirmed by the refund.processed webhook (see
    // app/api/webhooks/razorpay/route.ts's markRefundProcessed), same
    // "webhook is the authoritative fallback" shape as order payments.
    // orders.paymentStatus only ever flips to 'refunded' once a refund is
    // GENUINELY 'processed' — never while still 'processing' — so it can
    // never claim more than getRefundedAmount (which only counts
    // 'processed' rows) can actually back up.
    const genuinelyProcessed = result.status === 'processed';
    const [updated] = await db
      .update(refunds)
      .set({
        status: genuinelyProcessed ? 'processed' : 'processing',
        razorpayRefundId: result.id,
        processedAt: genuinelyProcessed ? new Date() : null,
      })
      .where(eq(refunds.id, pending.id))
      .returning();

    if (genuinelyProcessed) {
      const newTotalRefunded = alreadyRefunded + amountRupees;
      if (newTotalRefunded >= total - 0.01) {
        await db.update(orders).set({ paymentStatus: 'refunded' }).where(eq(orders.id, orderId));
      }
    }

    // User's own follow-up call (2026-09-03): no automatic money movement
    // against the seller, but a refund landing on an order she's already
    // been paid out for must never just quietly happen — auto-flag it as
    // a trackable dispute so recovering it from her doesn't depend on
    // anyone remembering a one-time warning banner.
    const payoutWarning = await getOrderPayoutWarning(orderId, sellerIdsForWarning);
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

/**
 * Confirms a refund that started 'processing' has genuinely completed —
 * called from the `refund.processed` webhook event
 * (app/api/webhooks/razorpay/route.ts), the only authoritative source for
 * an async refund's real outcome. Idempotent (a re-delivered webhook is a
 * safe no-op) — only ever moves a still-'processing' row forward, never
 * touches one already 'processed' or 'failed'. Flips orders.paymentStatus
 * to 'refunded' here too if this is what finally completes the order's
 * full refunded amount — the one other place besides refundOrder's own
 * synchronous-completion path that can make that transition.
 */
export async function markRefundProcessed(razorpayRefundId: string): Promise<void> {
  const [claimed] = await db
    .update(refunds)
    .set({ status: 'processed', processedAt: new Date() })
    .where(and(eq(refunds.razorpayRefundId, razorpayRefundId), eq(refunds.status, 'processing')))
    .returning();
  if (!claimed) return;

  const [total, refundedAmount] = await Promise.all([
    computeOrderTotalRupees(claimed.orderId),
    getRefundedAmount(claimed.orderId),
  ]);
  if (refundedAmount >= total - 0.01) {
    await db.update(orders).set({ paymentStatus: 'refunded' }).where(eq(orders.id, claimed.orderId));
  }
}

/**
 * The rare case where an async refund genuinely fails after being created
 * — called from the `refund.failed` webhook event. Same idempotent
 * "only ever moves a still-'processing' row" shape as markRefundProcessed.
 */
export async function markRefundFailed(razorpayRefundId: string, reason: string): Promise<void> {
  await db
    .update(refunds)
    .set({ status: 'failed', failureReason: reason.slice(0, 300) })
    .where(and(eq(refunds.razorpayRefundId, razorpayRefundId), eq(refunds.status, 'processing')));
}
