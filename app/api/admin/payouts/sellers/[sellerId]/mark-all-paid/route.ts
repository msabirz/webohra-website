import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { payouts } from '@/db/schema';
import { z } from 'zod';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { markPayoutPaidManually } from '@/lib/payouts';

const markAllPaidSchema = z.object({
  note: z.string().trim().min(5, 'Explain how you actually paid her (e.g. bank/UPI reference)').max(300),
});

/**
 * POST /api/admin/payouts/sellers/[sellerId]/mark-all-paid — the manual
 * counterpart to send-all: Admin already transferred everything owed to
 * this seller herself (one NEFT covering several orders, say) and is
 * recording it across every pending/failed row for her at once, with one
 * shared note. Same per-row audit trail as calling mark-paid individually
 * — this just saves the clicking. Never touches RazorpayX.
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

  const body = await request.json().catch(() => null);
  const parsed = markAllPaidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const pendingRows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(and(eq(payouts.sellerId, sellerId), inArray(payouts.status, ['pending', 'failed'])));

  if (pendingRows.length === 0) {
    return NextResponse.json({ marked: 0, failed: 0, results: [] });
  }

  const staffId = Number(session!.sub);
  const results: Array<{ payoutId: number; ok: boolean; error?: string }> = [];
  for (const row of pendingRows) {
    const result = await markPayoutPaidManually(row.id, staffId, parsed.data.note);
    results.push(result.ok ? { payoutId: row.id, ok: true } : { payoutId: row.id, ok: false, error: result.error });
  }

  const marked = results.filter((r) => r.ok).length;
  return NextResponse.json({ marked, failed: results.length - marked, results });
}
