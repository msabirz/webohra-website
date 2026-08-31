import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles } from '@/db/schema';
import { adminSellerVerifySchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/sellers/[userId]/verify — FR-13/FR-7's manual-review
 * fallback: Admin approves (or reverses) a seller's ITS verification.
 * Publishing a listing already checks users.its_verified server-side (see
 * PATCH /api/listings/[idOrSlug]) — this is the only place that flag ever
 * flips.
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

  const body = await request.json().catch(() => null);
  const parsed = adminSellerVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({ itsVerified: parsed.data.itsVerified })
    .where(eq(users.id, id))
    .returning();

  return NextResponse.json({ itsVerified: updated.itsVerified });
}
