import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { notifications } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/notifications?status=failed — the audit trail behind
 * Notifications infrastructure (Tier 3, item 20, 2026-09-06). Since
 * every send here is dev-mode-logged only until real MSG91 credentials
 * exist, this is what lets Admin (and, later, real debugging) confirm a
 * notification was at least ATTEMPTED for the right event, without
 * digging through server logs.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');

  const rows = await db
    .select()
    .from(notifications)
    .where(statusFilter === 'failed' || statusFilter === 'sent' ? eq(notifications.status, statusFilter) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  return NextResponse.json({ notifications: rows });
}
