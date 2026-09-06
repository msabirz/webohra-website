import { NextResponse } from 'next/server';
import { resolveDisputeWithCreditSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { resolveDisputeWithCredit } from '@/lib/disputes';

/**
 * PATCH /api/admin/disputes/[id]/resolve-with-credit — the COD return
 * flow's money-moving step (2026-09-06). isAdmin, not just isStaff —
 * same reasoning as the wallet manual-adjustment endpoint: this moves
 * real money-equivalent balance, so Customer Support can see and
 * investigate a dispute but not resolve one this way.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = resolveDisputeWithCreditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await resolveDisputeWithCredit(
    Number(id),
    Number(session!.sub),
    parsed.data.sellerId,
    parsed.data.amountRupees,
    parsed.data.note,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ dispute: result.dispute });
}
