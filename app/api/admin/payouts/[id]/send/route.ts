import { NextResponse } from 'next/server';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { sendPayout } from '@/lib/payouts';

/**
 * POST /api/admin/payouts/[id]/send — the actual money-moving action.
 * isAdmin, not isStaff — same reasoning as the wallet adjustment endpoint:
 * viewing payouts is Customer Support's own tooling, sending real money
 * isn't. Right now this genuinely fails for every payout (RazorpayX isn't
 * configured — see lib/razorpay-payouts.ts's createPayout), and that
 * failure is recorded honestly on the payout row rather than pretending
 * to succeed.
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

  const result = await sendPayout(payoutId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ status: result.status });
}
