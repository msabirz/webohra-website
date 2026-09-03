import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts } from '@/db/schema';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { sendPayout } from '@/lib/payouts';

/**
 * POST /api/admin/payouts/sellers/[sellerId]/send-all — one click to clear
 * everything currently owed to one seller, instead of clicking "Send" on
 * each order's payout row individually. The exact scenario this exists
 * for: a multi-seller cart produces one payout row per seller per order —
 * a seller who shows up across several such orders can accumulate several
 * pending rows, and Admin shouldn't have to hunt them down one at a time.
 * Each row is still sent as its own real RazorpayX transfer (see
 * lib/payouts.ts's sendPayout) — this just loops that per pending/failed
 * row for the seller, sequentially, and reports what happened to each.
 * isAdmin, same reasoning as the single-payout send endpoint.
 */
export async function POST(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sellerId: sellerIdParam } = await params;
  const sellerId = Number(sellerIdParam);
  if (!Number.isInteger(sellerId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pendingRows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(and(eq(payouts.sellerId, sellerId), inArray(payouts.status, ['pending', 'failed'])));

  if (pendingRows.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, results: [] });
  }

  // Sequential, not parallel — each call to sendPayout is a real outbound
  // RazorpayX request; running them one at a time keeps this predictable
  // and easy to reason about if one seller has many rows, and avoids
  // hammering the gateway with a burst of simultaneous payout calls.
  const results: Array<{ payoutId: number; ok: boolean; status?: string; error?: string }> = [];
  for (const row of pendingRows) {
    const result = await sendPayout(row.id);
    results.push(
      result.ok
        ? { payoutId: row.id, ok: true, status: result.status }
        : { payoutId: row.id, ok: false, error: result.error },
    );
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent, failed: results.length - sent, results });
}
