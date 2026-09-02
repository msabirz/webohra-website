import { eq, sql, desc } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerWallets, walletTransactions } from '@/db/schema';

/** Her wallet row, created lazily at ₹0 the first time anything needs it —
 *  same "never a not-configured-yet state" pattern as subscription_settings'
 *  getOrCreateSettingsRow. */
export async function getOrCreateWallet(sellerId: number) {
  const [existing] = await db.select().from(sellerWallets).where(eq(sellerWallets.sellerId, sellerId));
  if (existing) return existing;
  const [created] = await db.insert(sellerWallets).values({ sellerId }).returning();
  return created;
}

export type CreditTopupResult =
  | { ok: true; alreadyCredited: boolean; balance: string }
  | { ok: false; error: string };

/**
 * Credits a real Razorpay top-up to a seller's wallet — the one place this
 * ever happens. Called from both the client-side verify endpoint (fast
 * path, right after her browser gets Razorpay's success callback) and the
 * webhook handler (authoritative fallback, in case she closes the tab
 * before the verify call lands). `gatewayPaymentId` is unique on
 * wallet_transactions specifically so whichever of those two calls arrives
 * second is a safe no-op rather than a double credit.
 *
 * The neon-http driver this project runs on has no real interactive
 * transactions (see db/index.ts), so the balance update and the audit-trail
 * insert run as one atomic db.batch instead — both land or neither does,
 * which is what actually makes the unique-constraint race-safety below
 * hold: if two calls somehow race for the exact same payment, the loser's
 * whole batch (balance update included) fails together on the duplicate
 * key, not just its insert.
 */
export async function creditWalletTopup(params: {
  sellerId: number;
  amountRupees: number;
  gatewayPaymentId: string;
}): Promise<CreditTopupResult> {
  const [existing] = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.gatewayPaymentId, params.gatewayPaymentId));
  if (existing) {
    const wallet = await getOrCreateWallet(params.sellerId);
    return { ok: true, alreadyCredited: true, balance: wallet.balance };
  }

  const wallet = await getOrCreateWallet(params.sellerId);
  // Best-effort snapshot for the audit row's balanceAfter — the wallet's
  // real balance column always ends up exactly right regardless (it's
  // incremented via the `balance + amount` SQL expression below, not this
  // JS value), but under a genuine simultaneous top-up this recorded
  // snapshot could be a few rupees off from the balance at the instant this
  // particular row was written. Acceptable for how rarely that overlaps in
  // practice; flagged here rather than silently assumed correct.
  const projectedBalance = (Number(wallet.balance) + params.amountRupees).toFixed(2);

  try {
    await db.batch([
      db
        .update(sellerWallets)
        .set({ balance: sql`${sellerWallets.balance} + ${params.amountRupees.toFixed(2)}` })
        .where(eq(sellerWallets.sellerId, params.sellerId)),
      db.insert(walletTransactions).values({
        sellerId: params.sellerId,
        type: 'topup',
        amount: params.amountRupees.toFixed(2),
        gatewayPaymentId: params.gatewayPaymentId,
        balanceAfter: projectedBalance,
      }),
    ]);

    return { ok: true, alreadyCredited: false, balance: projectedBalance };
  } catch (err) {
    // Unique violation on gateway_payment_id — the verify call and the
    // webhook raced for the same payment and this one lost. The whole batch
    // rolled back together, so the balance was never double-incremented;
    // report the real current balance rather than erroring out.
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === '23505') {
      const freshWallet = await getOrCreateWallet(params.sellerId);
      return { ok: true, alreadyCredited: true, balance: freshWallet.balance };
    }
    throw err;
  }
}

/** Her wallet balance + recent transaction history, newest first — the
 *  whole audit trail a seller can see for herself on /seller/wallet, and
 *  what Admin sees too (app/api/admin/wallets/[sellerId]), just with a
 *  higher limit there. */
export async function getWalletWithHistory(sellerId: number, limit = 50) {
  const wallet = await getOrCreateWallet(sellerId);
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.sellerId, sellerId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
  return { wallet, transactions };
}

/**
 * The other way a wallet balance can ever change — Admin manually
 * correcting it, always with a reason and always attributed to the staff
 * member who did it (initiatedByStaffId + reason, both required at the app
 * level here). This is deliberately the only non-gateway path into
 * wallet_transactions: real top-ups are automatic (creditWalletTopup),
 * everything else that isn't a real gateway payment goes through here, so
 * a balance never moves silently or unaccountably (the "no one is scamming
 * the wallet" requirement this whole audit trail exists for). Same
 * atomic-batch reasoning as creditWalletTopup — the balance update and the
 * audit row land together or not at all.
 */
export async function adjustWalletBalance(params: {
  sellerId: number;
  amountRupees: number;
  reason: string;
  staffId: number;
}): Promise<{ balance: string }> {
  const wallet = await getOrCreateWallet(params.sellerId);
  const projectedBalance = (Number(wallet.balance) + params.amountRupees).toFixed(2);

  await db.batch([
    db
      .update(sellerWallets)
      .set({ balance: sql`${sellerWallets.balance} + ${params.amountRupees.toFixed(2)}` })
      .where(eq(sellerWallets.sellerId, params.sellerId)),
    db.insert(walletTransactions).values({
      sellerId: params.sellerId,
      type: 'admin_adjustment',
      amount: params.amountRupees.toFixed(2),
      initiatedByStaffId: params.staffId,
      reason: params.reason,
      balanceAfter: projectedBalance,
    }),
  ]);

  return { balance: projectedBalance };
}
