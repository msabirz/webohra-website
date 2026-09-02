import { NextResponse } from 'next/server';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { adminWalletAdjustmentSchema } from '@/lib/validation';
import { adjustWalletBalance } from '@/lib/wallet';

/**
 * POST /api/admin/wallets/[sellerId]/adjust — Admin manually correcting a
 * seller's wallet balance, with a required reason (Fulfillment &
 * Subscriptions redesign, Phase 5's planning decision: automatic top-ups
 * are the normal path, admin-manual is the only other way a balance ever
 * moves, and only for genuinely audited corrections). isAdmin, not just
 * isStaff — this moves real money-equivalent balance, so Customer Support's
 * narrower role can view wallets (GET, above) but not adjust them.
 */
export async function POST(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sellerId = Number((await params).sellerId);
  if (!Number.isInteger(sellerId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminWalletAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { balance } = await adjustWalletBalance({
    sellerId,
    amountRupees: parsed.data.amountRupees,
    reason: parsed.data.reason,
    staffId: Number(session!.sub),
  });

  return NextResponse.json({ balance });
}
