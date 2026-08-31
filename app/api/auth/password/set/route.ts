import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { passwordSetSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/auth/password/set
 *
 * Sets (or replaces) a password for the signed-in account — the step that
 * turns "sign in with OTP every time" into "sign in with a password, OTP
 * only for recovery" (see /login's 'set-password' step). Requires an
 * existing session (from a just-completed OTP verify), not a raw phone —
 * you can only set a password for an account you've already proven you own.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = passwordSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.password) })
    .where(eq(users.id, Number(session.sub)));

  return NextResponse.json({ ok: true });
}
