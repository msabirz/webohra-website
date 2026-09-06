import { NextResponse } from 'next/server';
import { and, count, eq, gte, isNotNull, like, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { whatsappMessages, walletTransactions, enquiries, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

/**
 * GET /api/admin/whatsapp?range=7d|30d|90d (default 30d)
 *
 * The admin aggregate dashboard item 19 called for — only per-message
 * tracking existed before this (the POC demo page, one row at a time),
 * no view of Connect/Lead volume per seller at all. Same isStaff gate
 * and range convention as /api/admin/analytics.
 *
 * Billed amounts are read from wallet_transactions itself (matched by
 * its own reason prefix — see lib/whatsapp-connect.ts's
 * billConnectMessage and the consultation-request route's own comment),
 * not recomputed from the current configured fee × a count — that stays
 * correct even after Admin changes the ₹20/₹35 rate, since each row
 * already recorded the amount actually charged at the time.
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

  // Real Connect sends only — excludes the pre-existing hello_world POC
  // rows, which carry no listingId at all.
  const connectCondition = and(isNotNull(whatsappMessages.listingId), gte(whatsappMessages.createdAt, since));

  const [connectBySeller, connectAmountBySeller, leadCountBySeller, leadAmountBySeller, sellers] = await Promise.all([
    db
      .select({
        sellerId: whatsappMessages.sellerId,
        sent: count(),
        billed: sql<string>`count(*) filter (where ${whatsappMessages.billed} = true)`,
      })
      .from(whatsappMessages)
      .where(connectCondition)
      .groupBy(whatsappMessages.sellerId),
    db
      .select({
        sellerId: walletTransactions.sellerId,
        amount: sql<string>`coalesce(sum(abs(${walletTransactions.amount})), 0)`,
      })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.type, 'commission_deduction'),
          like(walletTransactions.reason, 'WhatsApp Connect —%'),
          gte(walletTransactions.createdAt, since),
        ),
      )
      .groupBy(walletTransactions.sellerId),
    db
      .select({ sellerId: enquiries.sellerId, count: count() })
      .from(enquiries)
      .where(gte(enquiries.createdAt, since))
      .groupBy(enquiries.sellerId),
    db
      .select({
        sellerId: walletTransactions.sellerId,
        amount: sql<string>`coalesce(sum(abs(${walletTransactions.amount})), 0)`,
      })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.type, 'commission_deduction'),
          like(walletTransactions.reason, 'WhatsApp Lead —%'),
          gte(walletTransactions.createdAt, since),
        ),
      )
      .groupBy(walletTransactions.sellerId),
    db.select({ sellerId: sellerProfiles.userId, businessName: sellerProfiles.businessName }).from(sellerProfiles),
  ]);

  const businessNameBySeller = new Map(sellers.map((s) => [s.sellerId, s.businessName]));
  const connectAmountMap = new Map(connectAmountBySeller.map((r) => [r.sellerId, Number(r.amount)]));
  const leadCountMap = new Map(leadCountBySeller.map((r) => [r.sellerId, r.count]));
  const leadAmountMap = new Map(leadAmountBySeller.map((r) => [r.sellerId, Number(r.amount)]));

  const sellerIds = new Set<number>([
    ...connectBySeller.map((r) => r.sellerId).filter((id): id is number => id !== null),
    ...leadCountBySeller.map((r) => r.sellerId).filter((id): id is number => id !== null),
  ]);

  const bySeller = Array.from(sellerIds)
    .map((sellerId) => {
      const connect = connectBySeller.find((r) => r.sellerId === sellerId);
      return {
        sellerId,
        businessName: businessNameBySeller.get(sellerId) ?? null,
        connectSent: connect?.sent ?? 0,
        connectBilled: Number(connect?.billed ?? 0),
        connectAmount: connectAmountMap.get(sellerId) ?? 0,
        leadCount: leadCountMap.get(sellerId) ?? 0,
        leadAmount: leadAmountMap.get(sellerId) ?? 0,
      };
    })
    .sort((a, b) => b.connectAmount + b.leadAmount - (a.connectAmount + a.leadAmount));

  const totals = bySeller.reduce(
    (acc, r) => ({
      connectSent: acc.connectSent + r.connectSent,
      connectBilled: acc.connectBilled + r.connectBilled,
      connectAmount: acc.connectAmount + r.connectAmount,
      leadCount: acc.leadCount + r.leadCount,
      leadAmount: acc.leadAmount + r.leadAmount,
    }),
    { connectSent: 0, connectBilled: 0, connectAmount: 0, leadCount: 0, leadAmount: 0 },
  );

  return NextResponse.json({ range: { key: rangeKey, days }, totals, bySeller });
}
