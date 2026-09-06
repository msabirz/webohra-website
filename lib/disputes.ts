import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { disputes, disputeComments, orderItems } from '@/db/schema';
import { creditWalletReversal } from '@/lib/wallet';
import { notifyDisputeOpened, notifyDisputeResolved } from '@/lib/notifications/triggers';

export type OpenDisputeResult = { ok: true; dispute: typeof disputes.$inferSelect } | { ok: false; error: string };

/**
 * Flags a new dispute on an order — Admin Panel transaction/dispute/refund
 * tooling, 2026-09-03. Refuses a second active thread for the same order
 * (see disputes' own schema comment on why) rather than letting duplicate
 * open disputes pile up; a genuinely new, separate issue on an order whose
 * last dispute is already 'resolved' is always allowed as its own new row.
 */
export async function openDispute(orderId: number, staffId: number, reason: string): Promise<OpenDisputeResult> {
  const [existingActive] = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.orderId, orderId), inArray(disputes.status, ['open', 'investigating'])));
  if (existingActive) {
    return { ok: false, error: 'This order already has an active dispute — add a note to it instead of opening a second one.' };
  }

  const [dispute] = await db
    .insert(disputes)
    .values({ orderId, reason, createdByStaffId: staffId })
    .returning();
  await db.insert(disputeComments).values({ disputeId: dispute.id, staffId, note: reason, statusChangedTo: 'open' });
  // Notifications infrastructure (Tier 3, item 20, 2026-09-06) — a no-op
  // here whenever sellerId isn't set (this action never asks staff to
  // pick one), a known, disclosed gap rather than a broken call — see
  // notifyDisputeOpened's own comment.
  await notifyDisputeOpened(dispute);
  return { ok: true, dispute };
}

export type UpdateDisputeResult = { ok: true; dispute: typeof disputes.$inferSelect } | { ok: false; error: string };

/**
 * One action covers every way a dispute's timeline moves forward — a pure
 * comment, a status change, a reassignment, or any combination in one go
 * (mirrors how a real support ticket usually works: you comment AND
 * transition status together). At least one of note/status/assignedToStaffId
 * must actually be provided — the route validates that before calling this.
 */
export async function updateDispute(
  disputeId: number,
  staffId: number,
  changes: { note?: string; status?: 'open' | 'investigating' | 'resolved'; assignedToStaffId?: number | null },
): Promise<UpdateDisputeResult> {
  const [existing] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
  if (!existing) return { ok: false, error: 'Dispute not found' };

  const updates: Partial<typeof disputes.$inferInsert> = { updatedAt: new Date() };
  if (changes.status) {
    updates.status = changes.status;
    updates.resolvedAt = changes.status === 'resolved' ? new Date() : null;
  }
  if (changes.assignedToStaffId !== undefined) {
    updates.assignedToStaffId = changes.assignedToStaffId;
  }

  const [dispute] = await db.update(disputes).set(updates).where(eq(disputes.id, disputeId)).returning();

  await db.insert(disputeComments).values({
    disputeId,
    staffId,
    note: changes.note ?? null,
    statusChangedTo: changes.status ?? null,
  });

  // Notifications infrastructure (Tier 3, item 20, 2026-09-06) — only on
  // a genuine transition TO resolved (this function doesn't check the
  // prior status, but a caller only ever sends `status: 'resolved'` when
  // she's actually resolving it, matching how this route is used
  // everywhere it's called).
  if (dispute && changes.status === 'resolved') {
    await notifyDisputeResolved(dispute);
  }

  return { ok: true, dispute };
}

/**
 * Auto-flags the "seller already got paid, buyer just got refunded"
 * scenario as a dispute — Admin Panel transaction/dispute/refund tooling,
 * 2026-09-03, user's own follow-up call. The money side stays exactly as
 * decided (no automatic clawback/wallet debit), but the RECORD-KEEPING
 * side is automatic: a one-time warning banner on the refund screen is
 * too easy to lose track of once the page is closed, so this creates a
 * real, assignable, trackable dispute row the same way a manually-flagged
 * one would be — Admin (or whoever it's assigned to) then follows up with
 * the seller herself and marks it resolved once recovered. Reuses
 * whatever active dispute already exists on the order (adds a note there
 * instead of opening a redundant second one) rather than always opening a
 * fresh one — see openDispute's own comment on why only one stays active
 * at a time. Called from lib/refunds.ts's refundOrder right after a
 * refund actually succeeds, only when getOrderPayoutWarning found
 * something to flag.
 */
export async function flagSellerRecoveryDispute(
  orderId: number,
  staffId: number,
  note: string,
): Promise<void> {
  const [existingActive] = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.orderId, orderId), inArray(disputes.status, ['open', 'investigating'])));

  if (existingActive) {
    await updateDispute(existingActive.id, staffId, { note });
    return;
  }

  await openDispute(orderId, staffId, note);
}

export async function getDisputeTimeline(disputeId: number) {
  return db
    .select()
    .from(disputeComments)
    .where(eq(disputeComments.disputeId, disputeId))
    .orderBy(desc(disputeComments.createdAt));
}

/**
 * The buyer-facing counterpart to openDispute above (2026-09-06,
 * marketplace-completeness scan) — she raises this herself from her own
 * order page, no staff involved yet. `buyerId` is null for a guest
 * checkout (no account to attribute it to; the order itself already
 * carries her name/phone/email). `sellerId` should always be passed when
 * the order has more than one seller — see the route's own comment on
 * why (the precision fix: a multi-seller order shouldn't show the exact
 * same dispute to a seller it isn't actually about).
 */
export async function openDisputeAsBuyer(
  orderId: number,
  buyerId: number | null,
  sellerId: number | null,
  reason: string,
): Promise<OpenDisputeResult> {
  const [existingActive] = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.orderId, orderId), inArray(disputes.status, ['open', 'investigating'])));
  if (existingActive) {
    return { ok: false, error: 'You already have an open report on this order — no need to send another.' };
  }

  const [dispute] = await db.insert(disputes).values({ orderId, reason, createdByBuyerId: buyerId, sellerId }).returning();
  await db.insert(disputeComments).values({ disputeId: dispute.id, buyerId, note: reason, statusChangedTo: 'open' });
  // Notifications infrastructure (Tier 3, item 20, 2026-09-06).
  await notifyDisputeOpened(dispute);
  return { ok: true, dispute };
}

/**
 * The COD return flow's other half (2026-09-06) — she raises this
 * herself on her own order, after marking the specific item 'returned'
 * (see app/api/sellers/order-items/[itemId]/return/route.ts, which calls
 * this right after that status change). `sellerId` here is always her
 * own id, both as the creator and as disputes.sellerId — there's no
 * ambiguity about which seller it's about the way a buyer-raised
 * multi-seller dispute has. `orderItemId` (added for the full payout
 * redesign, Tier 4 item 21) is what lets resolveDisputeWithCredit check
 * whether commission was ever actually charged for THIS item before
 * crediting anything back — see disputes.orderItemId's own schema
 * comment for why that check exists now.
 */
export async function openDisputeAsSeller(
  orderId: number,
  sellerId: number,
  reason: string,
  orderItemId: number,
): Promise<OpenDisputeResult> {
  const [existingActive] = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.orderId, orderId), inArray(disputes.status, ['open', 'investigating'])));
  if (existingActive) {
    return { ok: false, error: 'This order already has an active dispute.' };
  }

  const [dispute] = await db
    .insert(disputes)
    .values({ orderId, reason, createdBySellerId: sellerId, sellerId, orderItemId })
    .returning();
  // No buyerId/staffId on this row either — same "exactly one creator
  // column set" rule as the buyer/staff paths, just the third option.
  await db.insert(disputeComments).values({ disputeId: dispute.id, note: reason, statusChangedTo: 'open' });
  return { ok: true, dispute };
}

export type ResolveWithCreditResult = { ok: true; dispute: typeof disputes.$inferSelect } | { ok: false; error: string };

/**
 * Resolves a dispute AND credits the seller's wallet in one action — the
 * COD return flow's actual money-moving step (2026-09-06). Always a
 * wallet credit, never a bank transfer, per the user's own explicit
 * decision — there is deliberately no "resolve without crediting"
 * variant of this specific action; use the plain status-update path
 * (updateDispute above) for a dispute that doesn't need money to move.
 * `sellerId` must be passed explicitly rather than read off the dispute
 * row — a staff-created dispute may have no sellerId set at all, and
 * this is the one place a real amount has to land on a real wallet, so
 * guessing wrong here is worse than requiring the caller to be sure.
 */
export async function resolveDisputeWithCredit(
  disputeId: number,
  staffId: number,
  sellerId: number,
  amountRupees: number,
  note: string,
): Promise<ResolveWithCreditResult> {
  const [existing] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
  if (!existing) return { ok: false, error: 'Dispute not found' };
  if (existing.status === 'resolved') return { ok: false, error: 'This dispute is already resolved.' };

  // Full payout redesign (Tier 4, item 21, 2026-09-06) — a return raised
  // during the settlement buffer (delivered less than 7 days ago) means
  // no commission was ever actually charged for this item yet; crediting
  // a "reversal" would be a real double-credit, not a no-op. Only checked
  // when this dispute is tied to a specific item at all (the COD return
  // flow always sets one — see openDisputeAsSeller); a staff/buyer-raised
  // dispute with no orderItemId skips this check entirely, same as
  // before this column existed.
  if (existing.orderItemId) {
    const [item] = await db.select({ settledAt: orderItems.settledAt }).from(orderItems).where(eq(orderItems.id, existing.orderItemId));
    if (item && !item.settledAt) {
      return {
        ok: false,
        error:
          'No commission has been charged for this item yet (still within the settlement buffer) — there\'s nothing to credit back. Use "Mark resolved" instead.',
      };
    }
  }

  await creditWalletReversal({
    sellerId,
    amountRupees,
    orderId: existing.orderId,
    reason: note,
  });

  const [dispute] = await db
    .update(disputes)
    .set({ status: 'resolved', amount: amountRupees.toFixed(2), resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(disputes.id, disputeId))
    .returning();

  await db.insert(disputeComments).values({
    disputeId,
    staffId,
    note: `${note} — ₹${amountRupees.toLocaleString('en-IN')} credited to her wallet.`,
    statusChangedTo: 'resolved',
  });

  // Notifications infrastructure (Tier 3, item 20, 2026-09-06).
  if (dispute) {
    await notifyDisputeResolved(dispute);
  }

  return { ok: true, dispute };
}
