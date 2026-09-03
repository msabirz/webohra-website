/**
 * Shared stage list for order_items.status — kept in one place so the API
 * routes that enforce "forward only" and the UI that renders/labels the
 * steps can never quietly drift apart. 'cancelled' (added 2026-09-03, Admin
 * Panel cancel-items tooling) is deliberately NOT part of this linear
 * sequence — it's a side-branch terminal state reachable from any
 * non-delivered stage via its own dedicated action
 * (lib/order-cancellation.ts), never through the normal forward-only
 * advance-status flow.
 */
export const ORDER_ITEM_STAGES = ['placed', 'packed', 'shipped', 'delivered'] as const;
export type OrderItemStage = (typeof ORDER_ITEM_STAGES)[number];

export type OrderItemStatus = OrderItemStage | 'cancelled';

export function isOrderItemStatus(value: unknown): value is OrderItemStatus {
  return typeof value === 'string' && ((ORDER_ITEM_STAGES as readonly string[]).includes(value) || value === 'cancelled');
}

export function isOrderItemStage(status: OrderItemStatus): status is OrderItemStage {
  return (ORDER_ITEM_STAGES as readonly string[]).includes(status);
}

export function stageIndex(status: OrderItemStage): number {
  return ORDER_ITEM_STAGES.indexOf(status);
}

/** True only if `next` is strictly further along than `current` — a seller
 *  or admin can jump ahead (e.g. hand-delivered, skip straight to
 *  'delivered') but can never move an item backward once recorded. Always
 *  false once `current` is 'cancelled' — nothing advances a cancelled item;
 *  that's the whole point of it being a terminal side-branch. */
export function isForwardMove(current: OrderItemStatus, next: OrderItemStage): boolean {
  if (!isOrderItemStage(current)) return false;
  return stageIndex(next) > stageIndex(current);
}

export const ORDER_ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** The next stage after `current`, or null if it's already the last one —
 *  or already 'cancelled', which has no next stage at all. */
export function nextStage(current: OrderItemStatus): OrderItemStage | null {
  if (!isOrderItemStage(current)) return null;
  const i = stageIndex(current);
  return i < ORDER_ITEM_STAGES.length - 1 ? ORDER_ITEM_STAGES[i + 1] : null;
}

/** Whether Admin can cancel this specific item right now — blocked once
 *  it's already 'delivered' (a return after delivery is a refund WITHOUT
 *  un-delivering it, via the plain "Refund buyer" action, not this) or
 *  already 'cancelled' itself. */
export function canCancelItem(status: OrderItemStatus): boolean {
  return status !== 'delivered' && status !== 'cancelled';
}
