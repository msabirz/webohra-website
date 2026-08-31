import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, jamaats } from '@/db/schema';
import { sellerAttachSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/sellers/register/attach
 *
 * "Become a seller" for someone who already has a WE Bohra account (as a
 * buyer, or an earlier abandoned attempt) — session-gated, so her email,
 * phone (already OTP-verified once at her original signup), and password
 * don't need collecting again. Just adds the business details a fresh
 * registration also collects. its_verified still stays false — Admin
 * review (FR-7) is unaffected by which path created the seller profile.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerAttachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const userId = Number(session.sub);
  const [existingProfile] = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId));
  if (existingProfile) {
    return NextResponse.json({ error: 'You already have a seller profile' }, { status: 409 });
  }

  const { businessName, itsId, plansDelhiveryShipping, jamaatId } = parsed.data;

  if (plansDelhiveryShipping && jamaatId) {
    const [jamaat] = await db.select().from(jamaats).where(eq(jamaats.id, jamaatId));
    if (!jamaat || !jamaat.active) {
      return NextResponse.json(
        { error: 'Select a valid jamaat', issues: { jamaatId: ['Select a valid jamaat'] } },
        { status: 400 },
      );
    }
  }

  await db.update(users).set({ itsId }).where(eq(users.id, userId));
  await db.insert(sellerProfiles).values({
    userId,
    businessName,
    jamaatId: plansDelhiveryShipping ? jamaatId : null,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
