import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { forgotPasswordRequestSchema } from '@/lib/validation';
import { requestOtp } from '@/lib/otp/service';

/**
 * POST /api/auth/password/forgot-request
 *
 * There's no transactional email sender wired up (see root CLAUDE.md's tech
 * stack — email delivery is listed, not built), so "forgot password"
 * delivers the reset code to the phone number already on file instead of
 * emailing a link — the one channel that's actually real right now. Returns
 * a masked hint (last 4 digits) so she recognizes which number to check.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!user) {
    return NextResponse.json({ error: 'No account found for this email' }, { status: 404 });
  }

  const result = await requestOtp(user.phone);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Please wait ${result.retryAfterSeconds}s before requesting another code` },
      { status: 429 },
    );
  }

  return NextResponse.json({
    sent: true,
    phoneHint: user.phone.slice(-4),
    devCode: result.devCode,
  });
}
