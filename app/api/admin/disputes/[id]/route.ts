import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { disputeComments, users } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { adminUpdateDisputeSchema } from '@/lib/validation';
import { updateDispute } from '@/lib/disputes';

/**
 * PATCH /api/admin/disputes/[id] — the one action that covers every way a
 * dispute's timeline can move forward (a note, a status change, a
 * reassignment, or any mix — see lib/disputes.ts's updateDispute). isStaff,
 * not isAdmin — working a dispute is an investigation/record-keeping
 * action, not a money-moving one (the actual refund still only happens
 * through the separate isAdmin-gated /refund route on the order itself).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const disputeId = Number(id);
  if (!Number.isInteger(disputeId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminUpdateDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await updateDispute(disputeId, Number(session!.sub), parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const timeline = await db
    .select({
      id: disputeComments.id,
      note: disputeComments.note,
      statusChangedTo: disputeComments.statusChangedTo,
      createdAt: disputeComments.createdAt,
      staffName: users.name,
      staffEmail: users.email,
    })
    .from(disputeComments)
    .leftJoin(users, eq(users.id, disputeComments.staffId))
    .where(eq(disputeComments.disputeId, disputeId))
    .orderBy(desc(disputeComments.createdAt));

  return NextResponse.json({ dispute: result.dispute, comments: timeline });
}
