import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, shipments } from '@/db/schema';
import { canCancelItem } from '@/lib/order-item-status';
import { refundOrder, type RefundOrderResult } from '@/lib/refunds';

export type CancelItemsResult =
  | { ok: true; cancelledItemIds: number[]; refundAmount: number; refund: RefundOrderResult | null }
  | { ok: false; error: string };

/**
 * Cancels one or more of an order's line items — true item-by-item
 * selection, the user's own choice over a coarser per-seller-only version
 * — and, for an online-paid order, automatically refunds their exact
 * combined amount in the SAME action (also the user's own choice: no
 * separate confirm step, just a required reason that doubles as both the
 * item's audit note and the refund's own reason). Admin Panel transaction/
 * dispute/refund tooling, 2026-09-03. "Cancel whole order" is this same
 * function with every item id on the order passed in — no separate code
 * path needed.
 *
 * Refund amount is the selected items' own price total, PLUS a seller's
 * shipment charge too if this cancellation leaves every one of her items
 * on the order cancelled (nothing left to ship for her, so nothing left to
 * charge for shipping either) — never a blanket "refund everything"
 * assumption for a partial cancellation.
 *
 * Items are marked cancelled unconditionally before the refund is
 * attempted; if the refund call itself fails, the items STAY cancelled
 * (the fulfillment decision is real and shouldn't un-happen because a
 * gateway call failed) and the failure is recorded on a real 'failed'
 * refund row Admin can see and retry via the plain "Refund buyer" button —
 * same resilience-over-atomicity shape as every other two-step
 * action in this codebase (neon-http has no real transactions to lean on
 * here anyway).
 */
export async function cancelOrderItems(
  orderId: number,
  itemIds: number[],
  staffId: number,
  reason: string,
): Promise<CancelItemsResult> {
  if (itemIds.length === 0) {
    return { ok: false, error: 'Select at least one item to cancel.' };
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status === 'cancelled') {
    return { ok: false, error: 'This order is already cancelled.' };
  }

  const allOrderItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const selected = allOrderItems.filter((i) => itemIds.includes(i.id));
  if (selected.length !== itemIds.length) {
    return { ok: false, error: 'One or more of the selected items were not found on this order.' };
  }

  const notCancellable = selected.filter((i) => !canCancelItem(i.status));
  if (notCancellable.length > 0) {
    return {
      ok: false,
      error: `${notCancellable.length} of the selected item(s) can't be cancelled — already delivered, or already cancelled.`,
    };
  }

  await db
    .update(orderItems)
    .set({ status: 'cancelled', statusUpdatedAt: new Date(), cancelledReason: reason })
    .where(inArray(orderItems.id, itemIds));

  // Fold in a seller's shipment charge only when this cancellation empties
  // out her whole share of the order.
  const affectedSellerIds = Array.from(new Set(selected.map((i) => i.sellerId)));
  let refundAmount = selected.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
  for (const sellerId of affectedSellerIds) {
    const sellerItems = allOrderItems.filter((i) => i.sellerId === sellerId);
    const sellerFullyCancelled = sellerItems.every((i) => itemIds.includes(i.id) || i.status === 'cancelled');
    if (!sellerFullyCancelled) continue;
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.orderId, orderId), eq(shipments.sellerId, sellerId)));
    if (shipment?.charge) refundAmount += Number(shipment.charge);
  }

  // Every item across the whole order now cancelled — the order itself is
  // cancelled too, same terminal state her own self-service cancel would
  // reach, just admin-initiated this time.
  const anyStillActive = allOrderItems.some((i) => !itemIds.includes(i.id) && i.status !== 'cancelled');
  if (!anyStillActive) {
    await db
      .update(orders)
      .set({ status: 'cancelled', cancelledBy: 'ops', cancellationReason: reason })
      .where(eq(orders.id, orderId));
  }

  // COD: nothing was ever charged online, so cancelling is the whole
  // action — no refund call, nothing to record beyond the item(s)'
  // cancelledReason above.
  if (order.paymentMethod !== 'online' || refundAmount <= 0) {
    return { ok: true, cancelledItemIds: itemIds, refundAmount: 0, refund: null };
  }

  const refund = await refundOrder(orderId, staffId, refundAmount, reason, affectedSellerIds);
  return { ok: true, cancelledItemIds: itemIds, refundAmount, refund };
}
