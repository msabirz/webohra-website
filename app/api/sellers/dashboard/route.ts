import { NextResponse } from 'next/server';
import { and, count, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  listings,
  orders,
  orderItems,
  disputes,
  sellerWallets,
  sellerSubscriptions,
} from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { getActivePlan, type SellerType } from '@/lib/subscriptions';

const TREND_DAYS = 14;

/**
 * GET /api/sellers/dashboard — item 30 (2026-09-07). Everything the
 * redesigned dashboard needs in one call, mirroring the same "one
 * aggregate route, not five separate ones" shape as /api/admin/dashboard
 * — a real seller landing page should show her whole store at a glance,
 * not just listing counts (the entire old dashboard).
 *
 * Deliberately read-only: does NOT call getOrCreateWallet (which would
 * silently insert a wallet row the instant she views this page) — a
 * seller who's never had a single commission-deducting event yet
 * genuinely has no wallet row, and that's a real, honest "not set up"
 * state to show, not something to paper over with a side-effecting
 * write inside a GET.
 *
 * GMV/order-count eligibility mirrors the exact same rule
 * /api/admin/dashboard and /api/admin/analytics both use (an 'online'
 * order only counts once genuinely paid; every other method always did)
 * — same "two different GMV definitions across two pages would be a real
 * inconsistency" reasoning, just scoped to her own orderItems.sellerId
 * instead of the whole platform.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }
  const sellerId = Number(session.sub);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const trendSince = new Date(Date.now() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000);
  trendSince.setUTCHours(0, 0, 0, 0);

  const gmvEligible = and(
    eq(orderItems.sellerId, sellerId),
    eq(orders.status, 'placed'),
    or(sql`${orders.paymentMethod} != 'online'`, eq(orders.paymentStatus, 'paid')),
  );

  const [
    [wallet],
    [{ activeListings }],
    [{ draftListings }],
    [{ archivedListings }],
    [{ last30dOrders, last30dGmv }],
    [{ totalOrders }],
    herOrderIdRows,
    dailyRows,
  ] = await Promise.all([
    db.select({ balance: sellerWallets.balance }).from(sellerWallets).where(eq(sellerWallets.sellerId, sellerId)),
    db.select({ activeListings: count() }).from(listings).where(and(eq(listings.sellerId, sellerId), eq(listings.status, 'active'))),
    db.select({ draftListings: count() }).from(listings).where(and(eq(listings.sellerId, sellerId), eq(listings.status, 'draft'))),
    db.select({ archivedListings: count() }).from(listings).where(and(eq(listings.sellerId, sellerId), eq(listings.status, 'archived'))),
    db
      .select({
        last30dOrders: sql<number>`count(distinct ${orderItems.orderId})::int`,
        last30dGmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gmvEligible, gte(orders.createdAt, thirtyDaysAgo))),
    db
      .select({ totalOrders: sql<number>`count(distinct ${orderItems.orderId})::int` })
      .from(orderItems)
      .where(eq(orderItems.sellerId, sellerId)),
    // Same "which orders is she even part of" base set
    // GET /api/sellers/disputes already establishes, reused here for the
    // dashboard's open-dispute count so the two never disagree.
    db.selectDistinct({ orderId: orderItems.orderId }).from(orderItems).where(eq(orderItems.sellerId, sellerId)),
    db
      .select({
        day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        orders: sql<number>`count(distinct ${orderItems.orderId})::int`,
        gmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gmvEligible, gte(orders.createdAt, trendSince)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  const herOrderIds = herOrderIdRows.map((r) => r.orderId);
  const [{ openDisputes }] = herOrderIds.length
    ? await db
        .select({ openDisputes: count() })
        .from(disputes)
        .where(
          and(
            inArray(disputes.orderId, herOrderIds),
            or(isNull(disputes.sellerId), eq(disputes.sellerId, sellerId)),
            inArray(disputes.status, ['open', 'investigating']),
          ),
        )
    : [{ openDisputes: 0 }];

  // One row per seller_type she has (a mixed seller can hold both) — same
  // resolution GET /api/sellers/subscriptions already does, duplicated
  // rather than imported since that route returns more than this page
  // needs and this keeps the dashboard's own response shape self-contained.
  const rawSubscriptions = await db.select().from(sellerSubscriptions).where(eq(sellerSubscriptions.sellerId, sellerId));
  const subscriptions = await Promise.all(
    rawSubscriptions.map(async (s) => ({
      sellerType: s.sellerType,
      billingMode: s.billingMode,
      status: s.status,
      renewsAt: s.renewsAt,
      plan: await getActivePlan(sellerId, s.sellerType as SellerType),
    })),
  );

  const gmvByDay = new Map(dailyRows.map((r) => [r.day, Number(r.gmv)]));
  const ordersByDay = new Map(dailyRows.map((r) => [r.day, r.orders]));
  const daily: { date: string; orders: number; gmv: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, orders: ordersByDay.get(key) ?? 0, gmv: gmvByDay.get(key) ?? 0 });
  }

  return NextResponse.json({
    wallet: wallet ? { balance: wallet.balance } : null,
    listings: { active: activeListings, draft: draftListings, archived: archivedListings },
    orders: {
      total: totalOrders,
      last30dCount: last30dOrders,
      last30dGmv: Number(last30dGmv),
    },
    disputes: { openCount: openDisputes },
    subscriptions,
    daily,
  });
}
