import { NextResponse } from 'next/server';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  users,
  sellerProfiles,
  jamaats,
  listings,
  subcategories,
  sellerWallets,
  sellerSubscriptions,
  orders,
  orderItems,
  payouts,
} from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { getActivePlan, type SellerType } from '@/lib/subscriptions';

/** Real, collected money only — a COD order always counts (never in a
 *  payment pipeline to begin with); an 'online' order only counts once
 *  paymentStatus is 'paid'. Same condition used everywhere else this
 *  distinction matters (GET /api/sellers/orders, the admin dashboard's
 *  GMV figure). */
const REAL_MONEY_CONDITION = or(ne(orders.paymentMethod, 'online'), eq(orders.paymentStatus, 'paid'));

/**
 * GET /api/admin/sellers/[userId] — the "Seller 360" view: her profile and
 * products (original scope), plus — Fulfillment & Subscriptions redesign —
 * her wallet balance, her subscription per seller_type, her lifetime
 * order/earnings numbers, her pending payout total, and her
 * highest-revenue products. One round trip so the admin detail page never
 * has to stitch together several separate fetches for what's really one
 * "everything about this seller" screen.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;
  const id = Number(userId);

  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      itsId: users.itsId,
      itsVerified: users.itsVerified,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
      businessName: sellerProfiles.businessName,
      jamaatId: sellerProfiles.jamaatId,
      jamaatCity: jamaats.city,
      jamaatName: jamaats.name,
    })
    .from(sellerProfiles)
    .innerJoin(users, eq(sellerProfiles.userId, users.id))
    .leftJoin(jamaats, eq(sellerProfiles.jamaatId, jamaats.id))
    .where(eq(users.id, id));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sellerListings = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      status: listings.status,
      subcategoryName: subcategories.name,
      listingType: subcategories.listingType,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .where(eq(listings.sellerId, id))
    .orderBy(desc(listings.createdAt));

  const [
    [wallet],
    rawSubscriptions,
    [orderStats],
    payoutTotals,
    topProducts,
    recentOrders,
    payoutRows,
  ] = await Promise.all([
    db.select({ balance: sellerWallets.balance }).from(sellerWallets).where(eq(sellerWallets.sellerId, id)),
    db.select().from(sellerSubscriptions).where(eq(sellerSubscriptions.sellerId, id)),
    db
      .select({
        orderCount: sql<number>`count(distinct ${orders.id})::int`,
        gmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.sellerId, id), REAL_MONEY_CONDITION)),
    db
      .select({ status: payouts.status, total: sql<string>`coalesce(sum(${payouts.netAmount}), 0)` })
      .from(payouts)
      .where(eq(payouts.sellerId, id))
      .groupBy(payouts.status),
    db
      .select({
        listingId: orderItems.listingId,
        title: listings.title,
        status: listings.status,
        unitsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        revenue: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(listings, eq(orderItems.listingId, listings.id))
      .where(and(eq(orderItems.sellerId, id), REAL_MONEY_CONDITION))
      .groupBy(orderItems.listingId, listings.title, listings.status)
      .orderBy(desc(sql`sum(${orderItems.unitPrice} * ${orderItems.quantity})`))
      .limit(5),
    // Every order she has at least one item in — her own items/subtotal
    // only, same scoping as GET /api/sellers/orders (never another
    // seller's share on the same multi-seller order). Every "click to see
    // her orders" list on the admin side redirects into the SAME
    // /admin/orders/[orderNumber] page everything else here already links
    // to, never a separate seller-scoped order view.
    db
      .select({
        orderNumber: orders.orderNumber,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        status: orders.status,
        createdAt: orders.createdAt,
        itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        herSubtotal: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orderItems.sellerId, id))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt)),
    // Every payout row, not just the pending/processed totals below — "all
    // details" per the admin transaction-visibility redesign, 2026-09-03.
    db
      .select({
        id: payouts.id,
        orderId: payouts.orderId,
        orderNumber: orders.orderNumber,
        grossAmount: payouts.grossAmount,
        commissionAmount: payouts.commissionAmount,
        netAmount: payouts.netAmount,
        status: payouts.status,
        channel: payouts.channel,
        failureReason: payouts.failureReason,
        manualNote: payouts.manualNote,
        processedAt: payouts.processedAt,
        createdAt: payouts.createdAt,
      })
      .from(payouts)
      .innerJoin(orders, eq(payouts.orderId, orders.id))
      .where(eq(payouts.sellerId, id))
      .orderBy(desc(payouts.createdAt)),
  ]);

  // One row per seller_type she actually has, with the real, resolved plan
  // (recharge-mode rows have no planId of their own — see
  // getActivePlan's own comment) rather than a raw join that would come
  // back null for exactly the sellers Admin most needs to check on.
  const subscriptions = await Promise.all(
    rawSubscriptions.map(async (s) => ({
      sellerType: s.sellerType,
      billingMode: s.billingMode,
      status: s.status,
      plan: await getActivePlan(id, s.sellerType as SellerType),
    })),
  );

  const pendingPayoutTotal = payoutTotals
    .filter((p) => p.status === 'pending' || p.status === 'failed')
    .reduce((sum, p) => sum + Number(p.total), 0);
  const processedPayoutTotal = Number(payoutTotals.find((p) => p.status === 'processed')?.total ?? 0);

  return NextResponse.json({
    seller: row,
    listings: sellerListings,
    wallet: wallet ? { balance: wallet.balance } : null,
    subscriptions,
    orderStats: {
      orderCount: orderStats?.orderCount ?? 0,
      gmv: orderStats?.gmv ?? '0.00',
    },
    payoutStats: {
      pendingAmount: pendingPayoutTotal.toFixed(2),
      processedAmount: processedPayoutTotal.toFixed(2),
    },
    topProducts: topProducts.map((p) => ({
      ...p,
      listingType: sellerListings.find((l) => l.id === p.listingId)?.listingType ?? null,
    })),
    recentOrders,
    payoutRows,
  });
}
