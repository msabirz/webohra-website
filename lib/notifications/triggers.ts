import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, listings, users, disputes } from '@/db/schema';
import { sendNotification } from './service';
import { ORDER_ITEM_STATUS_LABEL, type OrderItemStatus } from '@/lib/order-item-status';

/**
 * Notifications infrastructure (Tier 3, item 20, 2026-09-06) — the core
 * trigger set the item called for: order confirmation, payment, shipping-
 * status updates, plus the dispute notification gap flagged during the
 * marketplace-completeness scan ("she only finds out about a dispute by
 * checking her Disputes page"). Kept in one file, separate from the
 * domain libs (lib/order-payment.ts, lib/disputes.ts) that call these —
 * each of those stays a one-line call, and every "what does this event
 * say, who receives it" decision lives in exactly one place instead of
 * being re-derived at each call site.
 *
 * Every function here resolves its own recipients (order.buyerEmail/
 * buyerPhone for a buyer, users.email/phone for a seller) — buyer contact
 * info always comes from the order row itself, never users.email/phone,
 * since a guest checkout has no user row at all and orders.buyerPhone is
 * always populated for both guest and registered checkout alike.
 *
 * General support tickets are NOT wired in here yet — deliberately out
 * of this build's scope (not one of the three examples the item named),
 * left as a known follow-up rather than silently built or silently
 * ignored.
 */

export async function notifyOrderConfirmed(order: typeof orders.$inferSelect) {
  await sendNotification({
    event: 'order_confirmed',
    relatedId: order.id,
    email: order.buyerEmail,
    phone: order.buyerPhone,
    subject: `Order #${order.orderNumber} confirmed`,
    emailBody: `Hi ${order.buyerName}, your order #${order.orderNumber} has been placed. We'll let you know as it ships.`,
    smsBody: `WE Bohra: Order #${order.orderNumber} confirmed. Track it anytime with this number.`,
  });
}

export async function notifyPaymentReceived(order: typeof orders.$inferSelect) {
  await sendNotification({
    event: 'payment_received',
    relatedId: order.id,
    email: order.buyerEmail,
    phone: order.buyerPhone,
    subject: `Payment received — order #${order.orderNumber}`,
    emailBody: `Hi ${order.buyerName}, we've received your payment for order #${order.orderNumber}. Your order is confirmed.`,
    smsBody: `WE Bohra: Payment received for order #${order.orderNumber}. Your order is confirmed.`,
  });
}

export async function notifyPaymentFailed(order: typeof orders.$inferSelect) {
  await sendNotification({
    event: 'payment_failed',
    relatedId: order.id,
    email: order.buyerEmail,
    phone: order.buyerPhone,
    subject: `Payment failed — order #${order.orderNumber}`,
    emailBody: `Hi ${order.buyerName}, your payment for order #${order.orderNumber} didn't go through. Visit your order page to retry — nothing was charged.`,
    smsBody: `WE Bohra: Payment failed for order #${order.orderNumber}. Retry from your order page.`,
  });
}

/** Fired once per order-item status advance — a multi-item order sends
 *  one notification per item as each seller updates her own, not one
 *  batched summary. Simpler to reason about and directly tied to the
 *  existing per-item update codepath; worth revisiting if it turns out
 *  too chatty for a buyer with a large multi-item order in practice. */
export async function notifyShipmentStatusChanged(orderItemId: number, newStatus: OrderItemStatus) {
  const [row] = await db
    .select({
      orderNumber: orders.orderNumber,
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      buyerPhone: orders.buyerPhone,
      title: listings.title,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(listings, eq(listings.id, orderItems.listingId))
    .where(eq(orderItems.id, orderItemId));
  if (!row) return;

  const label = ORDER_ITEM_STATUS_LABEL[newStatus];
  await sendNotification({
    event: 'shipment_status_changed',
    relatedId: orderItemId,
    email: row.buyerEmail,
    phone: row.buyerPhone,
    subject: `Order #${row.orderNumber}: "${row.title}" is now ${label}`,
    emailBody: `Hi ${row.buyerName}, "${row.title}" from order #${row.orderNumber} is now ${label}.`,
    smsBody: `WE Bohra: "${row.title}" (order #${row.orderNumber}) is now ${label}.`,
  });
}

/** The seller-facing half of the dispute notification gap — fired
 *  regardless of which of the three creator paths opened it (staff,
 *  buyer, or the seller's own COD-return flow never reaches this at all,
 *  since she obviously already knows about a dispute she just opened
 *  herself). Silently does nothing if `dispute.sellerId` isn't known yet
 *  (a staff-created dispute on an old single-seller order, or a
 *  multi-seller buyer report where she hasn't been identified) — there's
 *  no one specific seller to tell in that case. */
export async function notifyDisputeOpened(dispute: typeof disputes.$inferSelect) {
  if (!dispute.sellerId) return;
  // A dispute she opened herself (the COD return flow) needs no
  // notification — she's the one who just filed it.
  if (dispute.createdBySellerId === dispute.sellerId) return;

  const [seller] = await db.select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, dispute.sellerId));
  if (!seller) return;

  await sendNotification({
    event: 'dispute_opened',
    relatedId: dispute.id,
    email: seller.email,
    phone: seller.phone,
    subject: 'A new dispute needs your attention',
    emailBody: `A dispute was opened on one of your orders: "${dispute.reason}". Check your Disputes page on the Seller Portal to respond.`,
    smsBody: `WE Bohra: A new dispute needs your attention. Check the Seller Portal.`,
  });
}

/** The buyer-facing half — fired whenever a dispute reaches 'resolved',
 *  regardless of whether that happened via the plain status update or
 *  the resolve-with-credit path. Uses the ORDER's buyer contact info
 *  (works for a guest-filed report too), not `disputes.createdByBuyerId`
 *  — a staff-opened dispute has no buyer id at all, but the order it's
 *  on always has real buyer contact details. */
export async function notifyDisputeResolved(dispute: typeof disputes.$inferSelect) {
  const [order] = await db
    .select({ buyerName: orders.buyerName, buyerEmail: orders.buyerEmail, buyerPhone: orders.buyerPhone, orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, dispute.orderId));
  if (!order) return;

  await sendNotification({
    event: 'dispute_resolved',
    relatedId: dispute.id,
    email: order.buyerEmail,
    phone: order.buyerPhone,
    subject: `Update on order #${order.orderNumber}`,
    emailBody: `Hi ${order.buyerName}, the issue you reported on order #${order.orderNumber} has been resolved.`,
    smsBody: `WE Bohra: The issue you reported on order #${order.orderNumber} has been resolved.`,
  });
}
