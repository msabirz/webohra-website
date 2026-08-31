import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { passwordResetSchema } from '@/lib/validation';
import { verifyOtp } from '@/lib/otp/service';
import { hashPassword } from '@/lib/password';
import { signSessionToken } from '@/lib/auth';

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Request a new code — none is pending for this number',
  expired: 'That code expired — request a new one',
  too_many_attempts: 'Too many incorrect attempts — request a new code',
  incorrect: 'Incorrect code',
};

/**
 * POST /api/auth/password/reset — "Forgot password" completion. Identified
 * by email (her sign-in credential); the OTP that proves it's really her
 * went to the phone on file (see /api/auth/password/forgot-request), not
 * one she types here — this just verifies that code against her account's
 * actual phone and sets the new password, logging her in immediately after.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, code, newPassword } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return NextResponse.json({ error: 'No account found for this email' }, { status: 404 });
  }

  const result = await verifyOtp(user.phone, code);
  if (!result.ok) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 400 });
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), phoneVerified: true })
    .where(eq(users.id, user.id));

  const token = await signSessionToken({
    sub: String(user.id),
    phone: user.phone,
    staffRole: user.staffRole,
  });

  return NextResponse.json({ token });
}
