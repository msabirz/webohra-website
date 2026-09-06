import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionSettings, whatsappMessages, listings } from '@/db/schema';
import { getWhatsAppProvider } from '@/lib/whatsapp';
import { deductWalletForCommission, getOrCreateWallet } from '@/lib/wallet';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp Connect & Lead — Meta Direct (Tier 3, item 19, 2026-09-06).
 *
 * The structural fix that makes any of this billable at all: a message a
 * buyer sends the seller directly (today's wa.me deep link) can never be
 * tracked — Meta only reports delivery/read status for messages sent
 * THROUGH the Business Platform. So the billable event isn't the buyer's
 * own message at all; it's a separate, business-initiated notification
 * WE Bohra's own number sends to the SELLER confirming a genuine connect
 * happened. The buyer's wa.me redirect to the seller's personal number
 * stays completely unchanged — same instant, form-free tap it always
 * was, see components/whatsapp-buy-button.tsx. This is what let this
 * ship without the full masked-relay redesign that would otherwise be
 * required to route a real two-way conversation through one shared
 * number (see whatsappMessages' own schema comment, and CLAUDE.md's
 * "don't build masked relay unless asked").
 */

async function getWhatsAppSettings() {
  const [settings] = await db.select().from(subscriptionSettings).limit(1);
  return {
    connectFeeRupees: settings ? Number(settings.whatsappConnectFeeRupees) : 20,
    leadFeeRupees: settings ? Number(settings.whatsappLeadFeeRupees) : 35,
    dailyLimitPerBuyer: settings ? settings.whatsappConnectDailyLimitPerBuyer : 10,
  };
}

export type ConnectEligibility =
  | { ok: true; billable: boolean; feeRupees: number }
  | { ok: false; error: string };

/**
 * The three "must-do" gates, in the order that matches what each one
 * actually protects: dedupe and rate-limit only ever decide whether a
 * NEW billable send is attempted — they never block the buyer's own
 * wa.me redirect, which costs nobody anything. The wallet-balance check
 * is the one gate the user explicitly said should block the action
 * itself (2026-09-05 finalized design: "insufficient funds blocks the
 * action... rather than ever going negative") — but it only matters on
 * the branch where we're about to attempt a fresh, real charge; a
 * dedupe/rate-limit skip never reaches it.
 */
export async function checkConnectEligibility(
  buyerId: number,
  listingId: number,
  sellerId: number,
): Promise<ConnectEligibility> {
  const { connectFeeRupees, dailyLimitPerBuyer } = await getWhatsAppSettings();

  const dedupeSince = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  const [recentForListing] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.buyerId, buyerId),
        eq(whatsappMessages.listingId, listingId),
        gte(whatsappMessages.createdAt, dedupeSince),
      ),
    )
    .limit(1);
  if (recentForListing) {
    // Already sent (or attempted) within 24h for this exact buyer+listing
    // — she can still message the seller herself, just no second Meta
    // send and no second charge.
    return { ok: true, billable: false, feeRupees: connectFeeRupees };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [{ billedToday }] = await db
    .select({ billedToday: count() })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.buyerId, buyerId),
        eq(whatsappMessages.billed, true),
        gte(whatsappMessages.createdAt, todayStart),
      ),
    );
  if (billedToday >= dailyLimitPerBuyer) {
    return { ok: true, billable: false, feeRupees: connectFeeRupees };
  }

  // A fresh, billable send — the one branch where the seller's wallet
  // actually needs to cover it, checked WITHOUT deducting anything yet
  // (the real deduction only ever happens later, from the webhook, once
  // delivery/read is confirmed — see billConnectMessage below). A quick
  // balance read, not a reservation; a genuine race against another
  // concurrent Connect is accepted here the same way it is anywhere else
  // in this codebase without real DB transactions.
  const wallet = await getOrCreateWallet(sellerId);
  if (Number(wallet.balance) < connectFeeRupees) {
    return { ok: false, error: 'This seller isn\'t reachable via WhatsApp Connect right now — try again shortly.' };
  }

  return { ok: true, billable: true, feeRupees: connectFeeRupees };
}

/**
 * Fires the actual Meta send — WE Bohra's number to the seller's phone —
 * and records it. Never throws on a provider failure: a failed Meta send
 * shouldn't block the buyer's own wa.me redirect, which is independent
 * of this. `billed` starts false regardless of `provider.isDev` — even
 * in dev mode nothing is billed until something explicitly marks it so
 * (see the dev-mode note on billConnectMessage).
 */
export async function sendConnectNotification(params: {
  listingId: number;
  sellerId: number;
  buyerId: number;
  sellerPhone: string;
  buyerName: string;
  listingTitle: string;
}) {
  const provider = getWhatsAppProvider();
  const result = await provider.sendTemplateMessage(params.sellerPhone, 'connect_notification', [
    params.buyerName,
    params.listingTitle,
  ]);

  await db.insert(whatsappMessages).values({
    listingId: params.listingId,
    sellerId: params.sellerId,
    buyerId: params.buyerId,
    toPhone: params.sellerPhone,
    waMessageId: result.ok ? result.waMessageId : null,
    status: result.ok ? (provider.isDev ? 'sent' : 'queued') : 'failed',
    failureReason: result.ok ? null : result.error,
  });
}

/**
 * The billing step itself — called from the WhatsApp webhook the moment
 * a message flips to 'delivered'/'read', or a reply arrives. The
 * conditional `WHERE billed = false` update is the entire idempotency
 * guarantee: whichever caller's update actually claims a row (affects 1
 * record) is the only one that goes on to touch the wallet — a
 * delivered event followed by a read event for the same message hits
 * this twice, but only the first claims anything.
 *
 * Dev-mode note: the dev WhatsApp provider never advances a message past
 * 'sent' on its own (no real webhook exists to do it) — this function is
 * only ever reached for real by a genuine Meta webhook call, so nothing
 * gets billed in dev mode without deliberately POSTing a fake webhook
 * payload. That's a correct reflection of reality, not a gap: there's no
 * real delivery to confirm without real credentials.
 */
export async function billConnectMessage(waMessageId: string) {
  const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.waMessageId, waMessageId));
  if (!message || message.billed || !message.sellerId) return;

  const [claimed] = await db
    .update(whatsappMessages)
    .set({ billed: true, billedAt: new Date() })
    .where(and(eq(whatsappMessages.id, message.id), eq(whatsappMessages.billed, false)))
    .returning();
  if (!claimed) return;

  const [listing] = message.listingId
    ? await db.select({ title: listings.title }).from(listings).where(eq(listings.id, message.listingId))
    : [];
  const { connectFeeRupees } = await getWhatsAppSettings();

  await deductWalletForCommission({
    sellerId: message.sellerId,
    amountRupees: connectFeeRupees,
    orderId: null,
    reason: `WhatsApp Connect — ${listing?.title ?? `listing #${message.listingId ?? '?'}`}`,
    // Already gated pre-send by checkConnectEligibility's balance check —
    // this can only ever go negative from a genuine race (another
    // Connect billed in the gap between send and this webhook firing),
    // and there's nothing left to block once the message has already
    // gone out. Same reasoning as COD settlement's own allowNegative.
    allowNegative: true,
  });
}
