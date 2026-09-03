import { NextResponse } from 'next/server';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { sendPayout } from '@/lib/payouts';

/**
 * POST /api/admin/payouts/[id]/send — the RazorpayX money-moving action.
 * isAdmin, not isStaff — same reasoning as the wallet adjustment endpoint:
 * viewing payouts is Customer Support's own tooling, sending real money
 * isn't. Also gated behind subscription_settings.razorpayxPayoutsEnabled
 * (see sendPayout's own comment) — a super admin has to have explicitly
 * approved RazorpayX for real use before this ever attempts a transfer,
 * independent of whether the technical config is ready. If she's already
 * paid this seller herself outside the system, use
 * POST .../mark-paid instead — that one never touches RazorpayX at all.
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

  const result = await sendPayout(payoutId, Number(session!.sub));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ status: result.status });
}
