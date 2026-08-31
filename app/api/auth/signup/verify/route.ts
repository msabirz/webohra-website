import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { signupVerifySchema } from '@/lib/validation';
import { verifyOtp } from '@/lib/otp/service';
import { signSessionToken } from '@/lib/auth';

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Request a new code — none is pending for this number',
  expired: 'That code expired — request a new one',
  too_many_attempts: 'Too many incorrect attempts — request a new code',
  incorrect: 'Incorrect code',
};

/**
 * POST /api/auth/signup/verify
 *
 * Completes registration: verifying the code marks her phone verified
 * (FR-30's gate) and logs her straight in — name, email, and password were
 * already collected and saved in /api/auth/signup.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { phone, code } = parsed.data;
  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user) {
    return NextResponse.json({ error: 'No pending signup found for this number' }, { status: 404 });
  }

  await db.update(users).set({ phoneVerified: true }).where(eq(users.id, user.id));

  const token = await signSessionToken({
    sub: String(user.id),
    phone: user.phone,
    staffRole: user.staffRole,
  });

  return NextResponse.json({ token });
}
