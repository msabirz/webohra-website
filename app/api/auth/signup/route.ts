import { NextResponse } from 'next/server';
import { eq, or } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { signupSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { requestOtp } from '@/lib/otp/service';

/**
 * POST /api/auth/signup
 *
 * Buyer registration — Amazon/Flipkart-style: name, email, phone, and
 * password collected together, matching signupSchema's comment. Creates
 * the account immediately (phoneVerified: false) and sends an OTP to her
 * phone; she isn't handed a session yet — /api/auth/signup/verify does
 * that once the code checks out, closing the FR-30 "verified once, at
 * registration" gate before she can actually sign in.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, phone, password } = parsed.data;

  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.phone, phone)));

  if (existing) {
    // A never-verified account matching BOTH fields exactly is almost
    // certainly her own abandoned attempt (e.g. she never got the OTP) —
    // let her resume rather than blocking with a false "already exists".
    const isResumableOwnAttempt =
      !existing.phoneVerified && existing.email === email && existing.phone === phone;

    if (!isResumableOwnAttempt) {
      const field = existing.email === email ? 'email' : 'phone';
      return NextResponse.json(
        {
          error:
            field === 'email'
              ? 'An account with this email already exists — try signing in instead'
              : 'An account with this phone number already exists — try signing in instead',
          issues: { [field]: ['Already in use'] },
        },
        { status: 409 },
      );
    }

    await db
      .update(users)
      .set({ name, passwordHash: hashPassword(password) })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      name,
      email,
      phone,
      phoneVerified: false,
      passwordHash: hashPassword(password),
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
