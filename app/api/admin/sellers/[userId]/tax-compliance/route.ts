import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles } from '@/db/schema';
import { adminTaxComplianceReviewSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/sellers/[userId]/tax-compliance — item 33 (2026-09-08).
 * Approve or reject a seller's submitted GST/Udyam number. isAdmin-gated
 * (not just isStaff) — same restriction as /verify (ITS): a
 * customer_support agent can see everything else about a seller but
 * shouldn't be the one deciding what unblocks her from selling.
 *
 * Reject requires a reason (enforced by adminTaxComplianceReviewSchema) so
 * she isn't left guessing what to fix before resubmitting.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;
  const id = Number(userId);

  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, id));
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!profile.taxIdType || !profile.taxIdNumber) {
    return NextResponse.json({ error: 'She hasn’t submitted a GST/Udyam number yet' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminTaxComplianceReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const approve = parsed.data.action === 'approve';
  const [updated] = await db
    .update(sellerProfiles)
    .set({
      taxIdVerified: approve,
      taxIdVerifiedAt: approve ? new Date() : null,
      taxIdVerifiedBy: approve ? Number(session!.sub) : null,
      taxIdRejectedReason: approve ? null : parsed.data.reason,
    })
    .where(eq(sellerProfiles.userId, id))
    .returning();

  return NextResponse.json({
    taxIdVerified: updated.taxIdVerified,
    taxIdRejectedReason: updated.taxIdRejectedReason,
  });
}
