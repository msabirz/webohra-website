import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { supportTickets, supportTicketCategories, users } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/support-tickets — every general complaint/question with
 * no order to attach it to (2026-09-06). ?status= narrows, same pattern
 * as /api/admin/disputes.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const conditions = [];
  if (status && ['open', 'investigating', 'resolved'].includes(status)) {
    conditions.push(eq(supportTickets.status, status as 'open' | 'investigating' | 'resolved'));
  }

  const rows = await db
    .select({
      id: supportTickets.id,
      name: supportTickets.name,
      email: supportTickets.email,
      phone: supportTickets.phone,
      message: supportTickets.message,
      status: supportTickets.status,
      categoryId: supportTickets.categoryId,
      categoryName: supportTicketCategories.name,
      assignedToStaffId: supportTickets.assignedToStaffId,
      assignedToName: users.name,
      staffNote: supportTickets.staffNote,
      createdAt: supportTickets.createdAt,
      resolvedAt: supportTickets.resolvedAt,
    })
    .from(supportTickets)
    .leftJoin(supportTicketCategories, eq(supportTicketCategories.id, supportTickets.categoryId))
    .leftJoin(users, eq(users.id, supportTickets.assignedToStaffId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportTickets.createdAt));

  return NextResponse.json({ tickets: rows });
}
