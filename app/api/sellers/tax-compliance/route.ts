import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles } from '@/db/schema';
import { sellerTaxComplianceSubmitSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/sellers/tax-compliance — item 33 (2026-09-08), the stakeholder's
 * GST/KYC requirement: submit (or resubmit) a real GST number or Udyam/MSME
 * enrollment ID. Every submission starts unverified — an admin must review
 * it (see PATCH /api/admin/sellers/[userId]/tax-compliance) before it
 * unblocks publishing (see the gate in PATCH /api/listings/[idOrSlug] and
 * /api/listings/bulk-status). Resubmitting after a rejection clears the
 * old rejection reason — it only ever describes the CURRENT number's
 * outcome, never a stale one.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const [existing] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId));
  if (!existing) {
    return NextResponse.json({ error: 'No seller profile found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerTaxComplianceSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(sellerProfiles)
    .set({
      taxIdType: parsed.data.taxIdType,
      taxIdNumber: parsed.data.taxIdNumber,
      taxIdSubmittedAt: new Date(),
      taxIdVerified: false,
      taxIdVerifiedAt: null,
      taxIdVerifiedBy: null,
      taxIdRejectedReason: null,
    })
    .where(eq(sellerProfiles.userId, userId))
    .returning();

  return NextResponse.json({
    taxIdType: updated.taxIdType,
    taxIdNumber: updated.taxIdNumber,
    taxIdSubmittedAt: updated.taxIdSubmittedAt,
    taxIdVerified: updated.taxIdVerified,
  });
}
