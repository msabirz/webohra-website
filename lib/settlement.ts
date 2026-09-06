import { and, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '@/db/index';
import { orderItems, orders, shipments, payouts, payoutCategories, subscriptionSettings } from '@/db/schema';
import { deductWalletForCommission } from '@/lib/wallet';

/**
 * Full payout redesign (Tier 4, item 21, 2026-09-06) — the actual
 * settlement engine. Replaces the old "payout created instantly on
 * payment confirmation" behavior (lib/order-payment.ts's
 * confirmOrderPayment no longer touches payouts at all) with a real
 * weekly batch, triggered by delivery instead of payment, with a 7-day
 * buffer past delivery before anything is actually charged.
 *
 * Settlement runs per (order, seller) pair, but only over whichever of
 * that pair's items are eligible THIS run — a multi-item order doesn't
 * wait for its slowest item; each item settles once IT individually
 * clears the buffer, potentially across more than one weekly run for the
 * same order. This is why `payouts` no longer assumes one row per order
 * (no unique constraint on orderId ever existed) and why shipping/
 * Delhivery costs — both attributed per (order, seller), not per item —
 * are only ever charged on whichever run is the FIRST to settle anything
 * for that pair, checked via previously-settled sibling items, never
 * double-charged on a later run for the same order.
 */

type EligibleItem = {
  id: number;
  orderId: number;
  sellerId: number;
  unitPrice: string;
  quantity: number;
};

export type SettlementRunResult = {
  itemsSettled: number;
  payoutsCreated: number;
  payoutAmount: number;
  walletDeductions: number;
  walletAmount: number;
};

export async function runWeeklySettlement(): Promise<SettlementRunResult> {
  const [settings] = await db.select().from(subscriptionSettings).limit(1);
  const bufferDays = settings?.settlementBufferDays ?? 7;
  const commissionPercent = Number(settings?.orderCommissionPercent ?? '10.00');
  const razorpayFeePercent = Number(settings?.razorpayFeePercent ?? '2.36');
  const delhiveryCost = Number(settings?.delhiveryCostPerShipment ?? '80.00');
  const cutoff = new Date(Date.now() - bufferDays * 24 * 60 * 60 * 1000);

  const eligible: EligibleItem[] = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      sellerId: orderItems.sellerId,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.status, 'delivered'),
        isNull(orderItems.settledAt),
        lte(orderItems.statusUpdatedAt, cutoff),
      ),
    );

  const result: SettlementRunResult = {
    itemsSettled: 0,
    payoutsCreated: 0,
    payoutAmount: 0,
    walletDeductions: 0,
    walletAmount: 0,
  };
  if (eligible.length === 0) return result;

  const [regularCategory] = await db
    .select()
    .from(payoutCategories)
    .where(eq(payoutCategories.key, 'regular_settlement'))
    .limit(1);

  // Group by (orderId, sellerId) — the same natural unit a payout row
  // has always been scoped to.
  const groups = new Map<string, EligibleItem[]>();
  for (const item of eligible) {
    const key = `${item.orderId}:${item.sellerId}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  for (const [key, items] of groups) {
    const [orderIdStr, sellerIdStr] = key.split(':');
    const orderId = Number(orderIdStr);
    const sellerId = Number(sellerIdStr);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) continue;

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.orderId, orderId), eq(shipments.sellerId, sellerId)));

    // Has anything from this (order, seller) pair already been settled in
    // an earlier run? If so, her shipping charge and any Delhivery cost
    // were already attributed then — this run only ever adds the
    // product-subtotal commission (and, for COD, the matching wallet
    // deduction) for the newly-eligible items, never the shipment costs
    // a second time.
    const [priorSettledItem] = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.sellerId, sellerId), isNotNull(orderItems.settledAt)))
      .limit(1);
    const isFirstSettlementForPair = !priorSettledItem;

    const productSubtotal = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    const shippingAmount = isFirstSettlementForPair ? Number(shipment?.charge ?? 0) : 0;
    const isDelhivery = shipment?.method === 'delhivery';
    const delhiveryAmount = isFirstSettlementForPair && isDelhivery ? delhiveryCost : 0;
    const commissionAmount = (productSubtotal * commissionPercent) / 100;
    const grossAmount = productSubtotal + shippingAmount;

    const itemIds = items.map((i) => i.id);

    if (order.paymentMethod === 'online') {
      const razorpayFeeShare = (grossAmount * razorpayFeePercent) / 100;
      const netAmount = grossAmount - commissionAmount - razorpayFeeShare - delhiveryAmount;
      await db.insert(payouts).values({
        orderId,
        sellerId,
        categoryId: regularCategory?.id ?? null,
        grossAmount: grossAmount.toFixed(2),
        commissionAmount: (commissionAmount + razorpayFeeShare + delhiveryAmount).toFixed(2),
        netAmount: netAmount.toFixed(2),
      });
      result.payoutsCreated += 1;
      result.payoutAmount += netAmount;
    } else {
      // COD — first real commission path COD has ever had. No Razorpay
      // fee (never went through a gateway); the seller still bears
      // commission + her share of the real Delhivery cost. Allowed to go
      // negative — there's nothing left to block once the item's already
      // been delivered, same reasoning lib/wallet.ts's own comment on
      // deductWalletForCommission has carried since before this had a
      // real caller.
      const amountToDeduct = commissionAmount + delhiveryAmount;
      if (amountToDeduct > 0) {
        await deductWalletForCommission({
          sellerId,
          amountRupees: amountToDeduct,
          orderId,
          reason: `Weekly settlement — order #${order.orderNumber}`,
          allowNegative: true,
        });
        result.walletDeductions += 1;
        result.walletAmount += amountToDeduct;
      }
    }

    await db.update(orderItems).set({ settledAt: new Date() }).where(inArray(orderItems.id, itemIds));
    result.itemsSettled += itemIds.length;
  }

  return result;
}
