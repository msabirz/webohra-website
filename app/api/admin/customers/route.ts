import { NextResponse } from 'next/server';
import { and, count, desc, ilike, inArray, isNull, notInArray, or } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, orders } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/customers — every registered buyer account, the
 * customer-facing equivalent of GET /api/admin/sellers (2026-09-04,
 * user's own ask — there was no admin module for managing customers at
 * all before this). "Customer" here means a real `users` row with no
 * seller_profiles row and no staff_role — a guest checkout (orders.userId
 * null) never gets one, since there's no account to browse to; her
 * order still shows up fine in /admin/orders by name/phone the same as
 * always, this module just doesn't invent a pseudo-account for her.
 *
 * ?q searches name, email, or phone. Order count comes along for the
 * list view (cheap, one grouped query); total spend is deliberately left
 * to the per-customer detail page — summing every order's real total
 * (lib/order-total.ts) for every row here would mean an unbounded number
 * of extra queries as the customer list grows.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q');

  const sellerUserIds = db.select({ id: sellerProfiles.userId }).from(sellerProfiles);

  const conditions = [isNull(users.staffRole), notInArray(users.id, sellerUserIds)];
  if (q) {
    conditions.push(
      or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`))!,
    );
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt));

  const customerIds = rows.map((row) => row.id);
  const orderCounts = customerIds.length
    ? await db
        .select({ userId: orders.userId, count: count() })
        .from(orders)
        .where(inArray(orders.userId, customerIds))
        .groupBy(orders.userId)
    : [];
  const countByUserId = new Map(orderCounts.map((row) => [row.userId, row.count]));

  return NextResponse.json({
    customers: rows.map((row) => ({ ...row, orderCount: countByUserId.get(row.id) ?? 0 })),
  });
}
