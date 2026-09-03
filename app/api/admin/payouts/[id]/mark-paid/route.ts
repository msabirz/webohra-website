import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { markPayoutPaidManually } from '@/lib/payouts';

const markPaidSchema = z.object({
  note: z.string().trim().min(5, 'Explain how you actually paid her (e.g. bank/UPI reference)').max(300),
});

/**
 * POST /api/admin/payouts/[id]/mark-paid — the non-RazorpayX path. Admin
 * already transferred this seller's money herself (her own net banking,
 * a UPI app, cash) and is recording that here — never a substitute for
 * "Send via RazorpayX", a genuinely different action with its own button
 * in the UI, so a non-technical admin never has to guess which one
 * actually moves money through the gateway (neither does, this one never
 * does) and which is just bookkeeping. isAdmin, same as sending — this
 * still marks real money as settled, even though nothing here calls out
 * to anything.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const payoutId = Number(id);
  if (!Number.isInteger(payoutId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = markPaidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await markPayoutPaidManually(payoutId, Number(session!.sub), parsed.data.note);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
