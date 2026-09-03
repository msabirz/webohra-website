import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { disputes, orders, users } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/disputes — every dispute across every order, for the
 * standalone /admin/disputes dashboard (Admin Panel transaction/dispute/
 * refund tooling, 2026-09-03) — a per-order dispute is also visible
 * inline on that order's own detail page, but this is the one place staff
 * see everything needing attention at once, open ones first. ?status= and
 * ?assignedToMe=1 (using the caller's own session — a genuinely personal
 * filter, not something a URL param alone could express safely) narrow
 * the list.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const assignedToMe = url.searchParams.get('assignedToMe') === '1';

  const conditions = [];
  if (status && ['open', 'investigating', 'resolved'].includes(status)) {
    conditions.push(eq(disputes.status, status as 'open' | 'investigating' | 'resolved'));
  }
  if (assignedToMe) {
    conditions.push(eq(disputes.assignedToStaffId, Number(session!.sub)));
  }

  const rows = await db
    .select({
      id: disputes.id,
      orderId: disputes.orderId,
      orderNumber: orders.orderNumber,
      buyerName: orders.buyerName,
      status: disputes.status,
      reason: disputes.reason,
      assignedToStaffId: disputes.assignedToStaffId,
      assignedToName: users.name,
      assignedToEmail: users.email,
      createdAt: disputes.createdAt,
      updatedAt: disputes.updatedAt,
      resolvedAt: disputes.resolvedAt,
    })
    .from(disputes)
    .innerJoin(orders, eq(orders.id, disputes.orderId))
    .leftJoin(users, eq(users.id, disputes.assignedToStaffId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(disputes.createdAt));

  return NextResponse.json({ disputes: rows });
}
