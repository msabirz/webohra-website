import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { disputes, disputeComments } from '@/db/schema';

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
