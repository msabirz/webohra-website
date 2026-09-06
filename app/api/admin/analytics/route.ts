import { NextResponse } from 'next/server';
import { and, count, eq, gte, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, users, sellerProfiles, categories, subcategories, listings } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

/**
 * GET /api/admin/analytics?range=7d|30d|90d (default 30d)
 *
 * Tier 3, item 18 (2026-09-06) — the "over time" half /api/admin/dashboard
 * never had; its own comment called it "basic analytics," a pure live
 * snapshot with no history, no trends, no top-sellers, no export.
 * Dashboard stays exactly what it was (today's numbers, at a glance);
 * this is deliberately a separate page/route rather than a rework of it.
 *
 * GMV eligibility here is the EXACT same condition as the dashboard's
 * all-time GMV number (order.status = 'placed', and either not an online
 * payment or genuinely paid) — two different GMV definitions across two
 * admin pages would be a real inconsistency, not a stylistic choice, so
 * this is copied deliberately rather than redefined.
 *
 * Daily buckets are UTC calendar days (`to_char(..., 'YYYY-MM-DD')` on
 * whatever timezone the DB connection runs in, Neon's default of UTC) —
 * not IST business days. Simpler, and there's no existing timezone-aware
 * bucketing convention anywhere else in this codebase to match instead;
 * flagged here rather than silently assumed to line up with a seller's
 * or buyer's local calendar day.
 *
 * CSV export happens client-side from this same response (see
 * app/admin/(portal)/analytics/page.tsx's toCsv, same pattern as the
 * Seller Portal's product export) — no separate export endpoint.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const rangeKey = url.searchParams.get('range') ?? '30d';
  const days = RANGE_DAYS[rangeKey] ?? RANGE_DAYS['30d'];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const gmvEligible = and(
    eq(orders.status, 'placed'),
    or(ne(orders.paymentMethod, 'online'), eq(orders.paymentStatus, 'paid')),
  );
  const dayExpr = sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`;

  const [
    dailyOrderRows,
    dailyGmvRows,
    [{ periodOrders }],
    [{ periodGmv }],
    [{ newBuyers }],
    [{ newSellers }],
    topSellerRows,
    topCategoryRows,
  ] = await Promise.all([
    db
      .select({ day: dayExpr, orders: count() })
      .from(orders)
      .where(gte(orders.createdAt, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ day: dayExpr, gmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gmvEligible, gte(orders.createdAt, since)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.select({ periodOrders: count() }).from(orders).where(gte(orders.createdAt, since)),
    db
      .select({ periodGmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gmvEligible, gte(orders.createdAt, since))),
    db
      .select({ newBuyers: count() })
      .from(users)
      .where(and(eq(users.phoneVerified, true), gte(users.createdAt, since))),
    db.select({ newSellers: count() }).from(sellerProfiles).where(gte(sellerProfiles.createdAt, since)),
    // Top sellers by GMV in the window — leftJoin sellerProfiles since a
    // handful of very old sellers (pre-dating the profile table) could in
    // principle have none; businessName just falls back to null rather
    // than dropping the row.
    db
      .select({
        sellerId: orderItems.sellerId,
        businessName: sellerProfiles.businessName,
        orders: sql<string>`count(distinct ${orderItems.orderId})`,
        gmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, orderItems.sellerId))
      .where(and(gmvEligible, gte(orders.createdAt, since)))
      .groupBy(orderItems.sellerId, sellerProfiles.businessName)
      .orderBy(sql`4 desc`)
      .limit(20),
    db
      .select({
        categoryName: categories.name,
        orders: sql<string>`count(distinct ${orderItems.orderId})`,
        gmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(listings, eq(listings.id, orderItems.listingId))
      .innerJoin(subcategories, eq(subcategories.id, listings.subcategoryId))
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(and(gmvEligible, gte(orders.createdAt, since)))
      .groupBy(categories.name)
      .orderBy(sql`3 desc`)
      .limit(10),
  ]);

  const orderByDay = new Map(dailyOrderRows.map((r) => [r.day, r.orders]));
  const gmvByDay = new Map(dailyGmvRows.map((r) => [r.day, Number(r.gmv)]));
  const daily: { date: string; orders: number; gmv: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, orders: orderByDay.get(key) ?? 0, gmv: gmvByDay.get(key) ?? 0 });
  }

  return NextResponse.json({
    range: { key: rangeKey, days, since: since.toISOString() },
    summary: {
      orders: periodOrders,
      gmv: Number(periodGmv),
      newBuyers,
      newSellers,
      avgOrderValue: periodOrders > 0 ? Number(periodGmv) / periodOrders : 0,
    },
    daily,
    topSellers: topSellerRows.map((r) => ({
      sellerId: r.sellerId,
      businessName: r.businessName,
      orders: Number(r.orders),
      gmv: Number(r.gmv),
    })),
    topCategories: topCategoryRows.map((r) => ({
      categoryName: r.categoryName,
      orders: Number(r.orders),
      gmv: Number(r.gmv),
    })),
  });
}
