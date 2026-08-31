import { NextResponse } from 'next/server';
import { eq, or } from 'drizzle-orm';
import { db } from '@/db/index';
import { users, sellerProfiles, jamaats } from '@/db/schema';
import { sellerRegisterSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { requestOtp } from '@/lib/otp/service';

/**
 * POST /api/sellers/register
 *
 * Seller registration — same email + password identity model as buyers
 * (see /api/auth/signup): name, email, phone, and password collected
 * together, plus her business details (ITS ID, business name, optional
 * Delhivery jamaat) up front rather than in a later step. Creates the
 * account and seller profile immediately (phoneVerified: false, itsVerified:
 * false) and sends an OTP; /api/sellers/register/verify closes FR-30's
 * "verified once, at registration" gate and hands back a session.
 *
 * its_verified stays false regardless — per FR-7 that's a separate Admin
 * manual-review step, not something registration can grant.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = sellerRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, phone, password, businessName, itsId, plansDelhiveryShipping, jamaatId } =
    parsed.data;

  if (plansDelhiveryShipping && jamaatId) {
    const [jamaat] = await db.select().from(jamaats).where(eq(jamaats.id, jamaatId));
    if (!jamaat || !jamaat.active) {
      return NextResponse.json(
        { error: 'Select a valid jamaat', issues: { jamaatId: ['Select a valid jamaat'] } },
        { status: 400 },
      );
    }
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.phone, phone)));

  if (existing) {
    // A never-verified account matching BOTH fields exactly is almost
    // certainly her own abandoned attempt — let her resume instead of
    // blocking with a false "already exists" (same rule as buyer signup).
    const isResumableOwnAttempt =
      !existing.phoneVerified && existing.email === email && existing.phone === phone;

    if (!isResumableOwnAttempt) {
      const field = existing.email === email ? 'email' : 'phone';
      return NextResponse.json(
        {
          error: 'You already have a WE Bohra account — sign in, then add your seller details.',
          code: 'already_has_account',
          issues: { [field]: ['Already in use'] },
        },
        { status: 409 },
      );
    }

    await db
      .update(users)
      .set({ name, passwordHash: hashPassword(password), itsId })
      .where(eq(users.id, existing.id));

    await db
      .insert(sellerProfiles)
      .values({
        userId: existing.id,
        businessName,
        jamaatId: plansDelhiveryShipping ? jamaatId : null,
      })
      .onConflictDoUpdate({
        target: sellerProfiles.userId,
        set: { businessName, jamaatId: plansDelhiveryShipping ? jamaatId : null },
      });
  } else {
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        phone,
        phoneVerified: false,
        passwordHash: hashPassword(password),
        itsId,
        itsVerified: false,
      })
      .returning();

    await db.insert(sellerProfiles).values({
      userId: user.id,
      businessName,
      jamaatId: plansDelhiveryShipping ? jamaatId : null,
    });
  }

  const result = await requestOtp(phone);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Please wait ${result.retryAfterSeconds}s before requesting another code` },
      { status: 429 },
    );
  }

  return NextResponse.json({ sent: true, devCode: result.devCode }, { status: 201 });
}
