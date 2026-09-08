import { sql } from 'drizzle-orm';
import { db } from '@/db/index';

export type StockReservationItem = { listingId: number; variantId: number | null; quantity: number };

/**
 * Real stock enforcement (item 32, 2026-09-08) — the 2026-09-07 QA sweep
 * found `stockQuantity` was purely informational everywhere: a real order
 * went through against a listing declared at 0 stock, and stock never
 * moved after a sale regardless. Design decisions made here, not silently
 * assumed:
 *
 * - Reserved (decremented) at ORDER CREATION, for every payment method —
 *   including 'online', before payment is confirmed. The alternative
 *   (wait for payment) would let two buyers both "successfully" place an
 *   order for the last unit while one's online payment is still pending,
 *   which is worse. The real trade-off this creates: a genuinely
 *   abandoned online checkout (she opens Razorpay's widget, never
 *   completes it, closes the tab — no payment.failed webhook ever fires)
 *   holds that stock reserved indefinitely. No automatic timeout/expiry
 *   sweep exists in this pass — a real, disclosed limitation, not an
 *   oversight; an admin can always cancel a stale order to free it back
 *   up manually in the meantime.
 * - Restored on any REAL cancellation (buyer self-cancel, admin/seller
 *   cancelOrderItems) — deliberately NOT on a merely 'failed' online
 *   payment (markOrderPaymentFailed): a failed payment is retryable, the
 *   SAME order/order_items rows, same razorpayOrderId (see the buyer
 *   order page's own `retryable` logic) — releasing stock the instant a
 *   payment attempt fails would let someone else buy the last unit out
 *   from under her mid-retry, then have her second attempt genuinely
 *   succeed against stock that's already gone. Only a real cancellation
 *   (hers or admin's) is the actual give-up point.
 *   Deliberately NOT restored on a return (item 16's COD-return flow) —
 *   a returned item's physical condition may have changed, so whether
 *   it's sellable again is a real decision left to the seller to make by
 *   editing her own stock number, never auto-assumed back to available.
 * - `stockQuantity: null` means "not tracked" everywhere this column is
 *   read (see its own schema comment) — never blocked, never decremented.
 *   This falls out for free from Postgres NULL arithmetic (`NULL - n` is
 *   NULL, not a wrong negative number), not a special case in this code.
 * - Every reservation is a single atomic conditional UPDATE
 *   (`stock = stock - qty WHERE stock IS NULL OR stock >= qty`), never a
 *   read-then-write — a plain SELECT-then-check would let two concurrent
 *   buyers both pass a stale read and both succeed against the last unit;
 *   this is what actually prevents that.
 */

async function reserveOne(item: StockReservationItem): Promise<boolean> {
  if (item.variantId) {
    const result = await db.execute(sql`
      UPDATE listing_variants
      SET stock_quantity = stock_quantity - ${item.quantity}
      WHERE id = ${item.variantId}
        AND (stock_quantity IS NULL OR stock_quantity >= ${item.quantity})
      RETURNING id
    `);
    return result.rows.length > 0;
  }
  const result = await db.execute(sql`
    UPDATE listings
    SET stock_quantity = stock_quantity - ${item.quantity}
    WHERE id = ${item.listingId}
      AND (stock_quantity IS NULL OR stock_quantity >= ${item.quantity})
    RETURNING id
  `);
  return result.rows.length > 0;
}

async function releaseOne(item: StockReservationItem): Promise<void> {
  if (item.variantId) {
    await db.execute(
      sql`UPDATE listing_variants SET stock_quantity = stock_quantity + ${item.quantity} WHERE id = ${item.variantId}`,
    );
    return;
  }
  await db.execute(sql`UPDATE listings SET stock_quantity = stock_quantity + ${item.quantity} WHERE id = ${item.listingId}`);
}

export type ReserveStockResult = { ok: true } | { ok: false; failedListingId: number };

/**
 * Reserves stock for every item in one checkout, atomically per item, in
 * order. If any item fails (not enough stock left), everything already
 * reserved earlier in THIS SAME call is released again before returning —
 * a multi-item cart checkout must never partially reserve, same
 * "all or nothing" expectation the rest of order creation already has.
 */
export async function reserveStockForItems(items: StockReservationItem[]): Promise<ReserveStockResult> {
  const reserved: StockReservationItem[] = [];
  for (const item of items) {
    const success = await reserveOne(item);
    if (!success) {
      for (const r of reserved) await releaseOne(r);
      return { ok: false, failedListingId: item.listingId };
    }
    reserved.push(item);
  }
  return { ok: true };
}

/** Single-item convenience wrapper — Pickup & Pay's checkout is always
 *  exactly one item, never a cart. */
export async function reserveStockForOne(item: StockReservationItem): Promise<boolean> {
  return reserveOne(item);
}

/** Restores stock for one or more items — a failed online payment, a
 *  buyer's own cancel, or an admin/seller cancellation. Safe to call on
 *  an item whose listing/variant no longer exists or was never tracked
 *  (stockQuantity null) — the UPDATE simply matches zero rows or leaves
 *  a null column null either way. */
export async function releaseStockForItems(items: StockReservationItem[]): Promise<void> {
  for (const item of items) await releaseOne(item);
}
