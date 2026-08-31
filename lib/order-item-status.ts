/**
 * Shared stage list for order_items.status — kept in one place so the API
 * routes that enforce "forward only" and the UI that renders/labels the
 * steps can never quietly drift apart.
 */
export const ORDER_ITEM_STAGES = ['placed', 'packed', 'shipped', 'delivered'] as const;

export type OrderItemStatus = (typeof ORDER_ITEM_STAGES)[number];

export function isOrderItemStatus(value: unknown): value is OrderItemStatus {
  return typeof value === 'string' && (ORDER_ITEM_STAGES as readonly string[]).includes(value);
}

export function stageIndex(status: OrderItemStatus): number {
  return ORDER_ITEM_STAGES.indexOf(status);
}

/** True only if `next` is strictly further along than `current` — a seller
 *  or admin can jump ahead (e.g. hand-delivered, skip straight to
 *  'delivered') but can never move an item backward once recorded. */
export function isForwardMove(current: OrderItemStatus, next: OrderItemStatus): boolean {
  return stageIndex(next) > stageIndex(current);
}

export const ORDER_ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

/** The next stage after `current`, or null if it's already the last one. */
export function nextStage(current: OrderItemStatus): OrderItemStatus | null {
  const i = stageIndex(current);
  return i < ORDER_ITEM_STAGES.length - 1 ? ORDER_ITEM_STAGES[i + 1] : null;
}
