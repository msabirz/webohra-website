import { NextResponse } from 'next/server';
import { and, inArray, lt } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries } from '@/db/schema';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

const AUTO_CLOSE_DAYS = 30;

/**
 * POST /api/admin/enquiries/sweep — FR-27's 30-day auto-close: any request
 * still 'initiated' or 'viewed' (i.e. the seller never accepted or
 * rejected it) with no update in 30 days becomes `auto_closed_no_update`
 * (never `completed` — the platform can't verify what actually happened on
 * WhatsApp, so it must not overstate it). Idempotent and safe to run as
 * often as Admin likes; there's no scheduler wired up yet, so this is a
 * manual trigger from the Admin dashboard rather than a real cron for now.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000);

  const closed = await db
    .update(enquiries)
    .set({ status: 'auto_closed_no_update' })
    .where(and(inArray(enquiries.status, ['initiated', 'viewed']), lt(enquiries.createdAt, cutoff)))
    .returning({ id: enquiries.id });

  return NextResponse.json({ closedCount: closed.length });
}
