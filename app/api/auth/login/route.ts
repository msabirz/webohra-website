import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { loginSchema } from '@/lib/validation';
import { verifyPassword } from '@/lib/password';
import { signSessionToken } from '@/lib/auth';

/**
 * POST /api/auth/login
 *
 * Buyer sign-in: email + password (see loginSchema's comment). Deliberately
 * vague on failure — never distinguishes "no account" from "wrong password"
 * to avoid an email-enumeration side channel.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  if (!user.phoneVerified) {
    // Shouldn't normally happen (signup only creates a password once she's
    // mid-verification), but if she abandoned that step, send her back to
    // finish it rather than letting an unverified phone in — FR-30's gate.
    return NextResponse.json(
      { error: 'Verify your phone number to finish setting up your account', phone: user.phone },
      { status: 403 },
    );
  }

  const token = await signSessionToken({
    sub: String(user.id),
    phone: user.phone,
    staffRole: user.staffRole,
  });

  return NextResponse.json({ token });
}
