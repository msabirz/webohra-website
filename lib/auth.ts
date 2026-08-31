import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Next.js loads .env.local itself; standalone scripts don't — see db/index.ts
// for why this mirrors that pattern.
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set — see .env.example.');
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

const SESSION_TTL = '30d';

export type SessionPayload = JWTPayload & {
  type: 'session';
  sub: string; // user id, as a string per JWT convention
  phone: string;
  staffRole: 'customer_support' | 'admin' | 'super_admin' | null;
};

/** Issued once sign-in (or signup verification) succeeds — this IS the login. */
export async function signSessionToken(
  payload: Omit<SessionPayload, 'type'>,
): Promise<string> {
  return new SignJWT({ ...payload, type: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== 'session') return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Pulls and verifies the session from a standard `Authorization: Bearer <jwt>` header. */
export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return verifySessionToken(header.slice('Bearer '.length));
}

/** Convenience guard for /api/admin/* routes — the non-negotiable server-side
 *  check (see site CLAUDE.md's "Admin/staff routes" rule). Any staff role
 *  passes — for read access and Customer Support's own tooling (FR-16,
 *  FR-47's pickup logging, and looking things up to help with queries). */
export function isStaff(session: SessionPayload | null): boolean {
  return !!session?.staffRole;
}

/** admin or super_admin — the routes SRS §3.3 scopes to Admin specifically
 *  (FR-12 categories, FR-13 seller verification, FR-14 listing moderation),
 *  not Customer Support (SRS §3.4's narrower, support-focused role). */
export function isAdmin(session: SessionPayload | null): boolean {
  return session?.staffRole === 'admin' || session?.staffRole === 'super_admin';
}

/** super_admin only — staff account management. Deliberately narrower than
 *  isAdmin so a compromised or overzealous admin account can't grant itself
 *  (or anyone else) more access on its own. */
export function isSuperAdmin(session: SessionPayload | null): boolean {
  return session?.staffRole === 'super_admin';
}
