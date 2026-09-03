import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { orderItems, shipments, payouts, subscriptionSettings, sellerPayoutAccounts } from '@/db/schema';
import { createPayout } from '@/lib/razorpay-payouts';

/**
 * Creates one payout row per seller represented in a just-paid order —
 * Fulfillment & Subscriptions redesign, Phase 5c. Called from
 * lib/order-payment.ts's confirmOrderPayment right after an order
 * genuinely becomes 'paid' for the first time (never on an idempotent
 * no-op re-confirmation, which would otherwise double-create these rows).
 * Idempotent on its own too — if payout rows already exist for this
 * order, this is a safe no-op, so a caller can't accidentally create them
 * twice even if it tries.
 *
 * Deliberately seller-count-agnostic: this groups by sellerId and creates
 * as many rows as there are sellers in the order, whether that's one or
 * five. That's the whole point of the RazorpayX approach over Route —
 * nothing here needed Route's automatic split to exist.
 */
export async function createPayoutsForOrder(orderId: number): Promise<void> {
  const [existing] = await db.select().from(payouts).where(eq(payouts.orderId, orderId)).limit(1);
  if (existing) return;

  const [items, orderShipments, [settings]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)),
    db.select().from(subscriptionSettings).limit(1),
  ]);
  if (items.length === 0) return;

  const commissionPercent = Number(settings?.orderCommissionPercent ?? '10.00');

  // Her order_items subtotal, grouped by seller — the product/service sale
  // portion commission actually applies to.
  const subtotalBySeller = new Map<number, number>();
  for (const item of items) {
    const lineTotal = Number(item.unitPrice) * item.quantity;
    subtotalBySeller.set(item.sellerId, (subtotalBySeller.get(item.sellerId) ?? 0) + lineTotal);
  }

  // Her own self-managed shipping charge (if any) passes through
  // untaxed — see subscription_settings.orderCommissionPercent's own
  // comment on why shipping never has commission applied to it. A
  // Delhivery shipment's charge is always null today (no live rate
  // lookup exists yet), so it contributes nothing here either way.
  const shippingBySeller = new Map<number, number>();
  for (const shipment of orderShipments) {
    if (shipment.charge === null) continue;
    shippingBySeller.set(shipment.sellerId, (shippingBySeller.get(shipment.sellerId) ?? 0) + Number(shipment.charge));
  }

  const rows = Array.from(subtotalBySeller.entries()).map(([sellerId, productSubtotal]) => {
    const shippingAmount = shippingBySeller.get(sellerId) ?? 0;
    const commissionAmount = (productSubtotal * commissionPercent) / 100;
    const grossAmount = productSubtotal + shippingAmount;
    const netAmount = grossAmount - commissionAmount;
    return {
      orderId,
      sellerId,
      grossAmount: grossAmount.toFixed(2),
      commissionAmount: commissionAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
    };
  });

  // A concurrent duplicate call (extremely unlikely — see
  // confirmOrderPayment's own race-safety comment on why this only ever
  // runs once per order in practice) would violate no constraint here and
  // could double-insert; guarded by the existence check above, which is
  // good enough given how this is actually invoked (never called outside
  // that one already-idempotent path).
  await db.insert(payouts).values(rows);
}

export type SendPayoutResult =
  | { ok: true; status: string }
  | { ok: false; error: string };

/**
 * The actual money-moving step for one payout row — a separate, explicit
 * action from creating the row (see app/api/admin/payouts/[id]/send).
 * Refuses to even attempt a RazorpayX call unless
 * subscription_settings.razorpayxPayoutsEnabled is true — that flag is the
 * deliberate stakeholder-approval gate, independent of whether
 * RAZORPAYX_ACCOUNT_NUMBER happens to be configured (technical readiness
 * and business sign-off are two different questions; this only checks the
 * second one before letting the first one matter at all). Never throws: a
 * failure here is recorded on the payout row itself as a real 'failed'
 * status with a reason, not an unhandled exception. On success, records
 * `channel: 'razorpayx'` and who triggered it — see markPayoutPaidManually
 * below for the other, deliberately distinct path a payout can reach
 * 'processed' through.
 */
export async function sendPayout(payoutId: number, staffId: number): Promise<SendPayoutResult> {
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId));
  if (!payout) return { ok: false, error: 'Payout not found' };
  // 'failed' is a genuinely re-sendable state, not a dead end — that's the
  // entire point of the admin UI's "Retry" button (same "forward-only but
  // failed-can-retry" shape as lib/order-payment.ts's confirmOrderPayment).
  // Only 'processing'/'processed'/'reversed' actually block a new attempt.
  if (payout.status !== 'pending' && payout.status !== 'failed') {
    return { ok: false, error: `This payout is already ${payout.status} — it can't be sent again.` };
  }

  const [settings] = await db.select().from(subscriptionSettings).limit(1);
  if (!settings?.razorpayxPayoutsEnabled) {
    const reason =
      'RazorpayX payouts have not been approved for use yet — ask a super admin to enable them in Settings before sending. Use "Mark as paid manually" if you already transferred this yourself.';
    await db.update(payouts).set({ status: 'failed', failureReason: reason }).where(eq(payouts.id, payoutId));
    return { ok: false, error: reason };
  }

  const [account] = await db
    .select()
    .from(sellerPayoutAccounts)
    .where(eq(sellerPayoutAccounts.sellerId, payout.sellerId));
  if (!account) {
    return { ok: false, error: "This seller hasn't set up a payout account yet." };
  }

  // Marked 'processing' before the real call so a slow/crashed request
  // never leaves this looking like it's still waiting to be tried —
  // guarded on still being 'pending' or 'failed' so two concurrent send
  // attempts for the same row can't both proceed.
  const [claimed] = await db
    .update(payouts)
    .set({ status: 'processing', failureReason: null })
    .where(and(eq(payouts.id, payoutId), inArray(payouts.status, ['pending', 'failed'])))
    .returning();
  if (!claimed) {
    return { ok: false, error: 'This payout is already being sent.' };
  }

  try {
    const result = await createPayout({
      fundAccountId: account.razorpayFundAccountId,
      amountRupees: Number(payout.netAmount),
      referenceId: `payout_${payout.id}_order_${payout.orderId}`,
      narration: `WE Bohra payout — order #${payout.orderId}`,
    });
    await db
      .update(payouts)
      .set({
        status: result.status === 'processed' || result.status === 'queued' ? 'processed' : 'processing',
        razorpayPayoutId: result.id,
        channel: 'razorpayx',
        actionedByStaffId: staffId,
        processedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));
    return { ok: true, status: result.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payout failed for an unknown reason';
    await db
      .update(payouts)
      .set({ status: 'failed', failureReason: message.slice(0, 300) })
      .where(eq(payouts.id, payoutId));
    return { ok: false, error: message };
  }
}

export type MarkPaidManuallyResult = { ok: true } | { ok: false; error: string };

/**
 * The other, deliberately separate way a payout ever reaches 'processed' —
 * Admin transferred the money herself, outside RazorpayX entirely (her own
 * net banking, a UPI app, cash), and is just recording that it happened.
 * No gateway call anywhere in this function. `note` is required, same
 * "an unexplained real-money event is never acceptable" reasoning as
 * wallet_transactions' admin_adjustment rows — it's the only record of
 * what actually happened, since there's no RazorpayX response to check
 * against. Recorded with `channel: 'manual'`, unambiguously distinct from
 * a real RazorpayX transfer everywhere this payout's history is shown.
 */
export async function markPayoutPaidManually(
  payoutId: number,
  staffId: number,
  note: string,
): Promise<MarkPaidManuallyResult> {
  const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId));
  if (!payout) return { ok: false, error: 'Payout not found' };
  if (payout.status !== 'pending' && payout.status !== 'failed') {
    return { ok: false, error: `This payout is already ${payout.status} — it can't be marked paid again.` };
  }

  const [claimed] = await db
    .update(payouts)
    .set({
      status: 'processed',
      channel: 'manual',
      actionedByStaffId: staffId,
      manualNote: note,
      failureReason: null,
      processedAt: new Date(),
    })
    .where(and(eq(payouts.id, payoutId), inArray(payouts.status, ['pending', 'failed'])))
    .returning();
  if (!claimed) {
    return { ok: false, error: 'This payout is already being sent.' };
  }

  return { ok: true };
}
