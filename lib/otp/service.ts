import { createHash, randomInt } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { otpCodes } from '@/db/schema';
import { getOtpProvider } from './index';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between requests, per phone
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export type RequestOtpResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: 'rate_limited'; retryAfterSeconds: number };

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const [mostRecent] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (mostRecent) {
    const elapsedMs = Date.now() - mostRecent.createdAt.getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: 'rate_limited',
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000),
      };
    }
  }

  const code = generateCode();
  await db.insert(otpCodes).values({
    phone,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const provider = getOtpProvider();
  await provider.send(phone, code);

  return { ok: true, devCode: provider.isDev ? code : undefined };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'expired' | 'too_many_attempts' | 'incorrect' };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const [pending] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  // No code ever requested, or the most recent one was already used — either
  // way the caller needs a fresh one, so treat both as "not_found".
  if (!pending || pending.consumedAt) {
    return { ok: false, error: 'not_found' };
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'expired' };
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'too_many_attempts' };
  }

  if (pending.codeHash !== hashCode(code)) {
    await db
      .update(otpCodes)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(otpCodes.id, pending.id));
    return { ok: false, error: 'incorrect' };
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, pending.id));
  return { ok: true };
}
