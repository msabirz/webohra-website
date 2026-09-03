import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orderItems, shipments } from '@/db/schema';

/**
 * The order total, computed the exact same way app/api/orders/route.ts
 * computes it at checkout time (item subtotal + any self-managed shipping
 * charge, Delhivery contributing nothing since it has no live rate lookup
 * yet) — pulled out here so refund validation (lib/refunds.ts) and the
 * admin order-detail view don't each reimplement it and risk drifting from
 * what checkout actually charged.
 */
export async function computeOrderTotalRupees(orderId: number): Promise<number> {
  const [items, orderShipments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)),
  ]);
  const itemsTotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const shippingTotal = orderShipments.reduce((sum, s) => sum + Number(s.charge ?? 0), 0);
  return itemsTotal + shippingTotal;
}
