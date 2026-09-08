import { NextResponse } from 'next/server';
import { db } from '@/db/index';
import { subscriptionSettings } from '@/db/schema';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { runWeeklySettlement } from '@/lib/settlement';

/**
 * GET + POST /api/admin/payouts/settle — the weekly settlement batch (full
 * payout redesign, Tier 4 item 21, 2026-09-06).
 *
 * Item 34 (2026-09-08) — GET added alongside the original POST. Vercel
 * Cron invokes a scheduled `path` with GET, never POST (confirmed by the
 * 2026-09-07 QA sweep, finding C-1) — the POST-only route meant the
 * `vercel.json` schedule below was silently a no-op in production the
 * whole time; a real admin's manual "Run settlement now" button (POST,
 * session-based) was never affected. Both verbs now share the exact same
 * logic via `handle()`.
 *
 * Two ways in: a real admin session (manual trigger — never gated by
 * `autoSettlementEnabled`, same as clicking any other admin action), OR a
 * request carrying `Authorization: Bearer <CRON_SECRET>` — the header
 * Vercel attaches automatically to a scheduled Cron invocation once
 * CRON_SECRET is set as an env var. A cron-authenticated call is ADDITIONALLY
 * gated on `subscriptionSettings.autoSettlementEnabled` (new, defaults
 * `false`) — the real, admin-visible on/off switch for automatic
 * settlement, separate from the GET/POST fix itself: without this gate,
 * fixing the routing bug alone would make Cron start actually running
 * money-moving settlement the moment CRON_SECRET exists in the Vercel
 * env, with zero visibility or control from the admin panel. Flip it on
 * at /admin/subscription-plans once you're ready for real automatic
 * settlement; manual triggering keeps working exactly as today either way.
 *
 * Idempotent and safe to run as often as anyone likes: runWeeklySettlement
 * only ever touches order items that are delivered, unsettled, and past
 * the configured buffer — running it twice in a row the second time
 * finds nothing new to do.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronCall = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCronCall) {
    const [settings] = await db
      .select({ autoSettlementEnabled: subscriptionSettings.autoSettlementEnabled })
      .from(subscriptionSettings)
      .limit(1);
    if (!settings?.autoSettlementEnabled) {
      return NextResponse.json({ ran: false, reason: 'Automatic settlement is turned off' });
    }
  } else {
    const session = await getSessionFromRequest(request);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const result = await runWeeklySettlement();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
