import { NextResponse } from 'next/server';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { runWeeklySettlement } from '@/lib/settlement';

/**
 * POST /api/admin/payouts/settle — the weekly settlement batch (full
 * payout redesign, Tier 4 item 21, 2026-09-06). Two ways in, same as any
 * Vercel Cron-triggered route needs: a real admin session (manual "Run
 * settlement now" — same pattern as the existing enquiry 30-day sweep),
 * OR a request carrying `Authorization: Bearer <CRON_SECRET>` — the
 * header Vercel itself attaches automatically to a scheduled Cron
 * invocation when CRON_SECRET is set as an env var (see vercel.json's
 * schedule for this route, set for every Saturday). No CRON_SECRET
 * configured yet means the cron path is simply unreachable — isAdmin
 * manual triggering still works regardless, exactly like today.
 *
 * Idempotent and safe to run as often as anyone likes: runWeeklySettlement
 * only ever touches order items that are delivered, unsettled, and past
 * the configured buffer — running it twice in a row the second time
 * finds nothing new to do.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronCall = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronCall) {
    const session = await getSessionFromRequest(request);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const result = await runWeeklySettlement();
  return NextResponse.json(result);
}
