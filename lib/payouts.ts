import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts, sellerPayoutAccounts, subscriptionSettings } from '@/db/schema';
import { createPayout } from '@/lib/razorpay-payouts';

// Payout ROWS are no longer created here — see lib/settlement.ts's
// runWeeklySettlement (full payout redesign, Tier 4 item 21, 2026-09-06).
// This file is now only the money-MOVING half: sending an already-created
// payout, or recording that it was paid manually.

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
  // RazorpayX Payouts only ever moves money against a real fund account.
  // Both current payout methods ('upi' and 'bank_account') do populate
  // one as of the 2026-09-03 redesign, so this null check is mostly a
  // defensive guard now rather than a normal-path branch — this whole
  // function is effectively unreachable in practice anyway (the UI hides
  // its button entirely, see RAZORPAYX_UI_ENABLED in the admin payout
  // pages), kept only in case RazorpayX Payouts comes back later.
  if (!account.razorpayFundAccountId) {
    return { ok: false, error: 'This seller is not set up for RazorpayX transfers — use "Mark as paid manually" instead.' };
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
