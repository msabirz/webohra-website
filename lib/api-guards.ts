import { NextResponse } from 'next/server';

/**
 * Item 36 (2026-09-08) — the 2026-09-07 QA sweep's L-1 finding: a handful
 * of admin PATCH routes update a row with `.set(parsed.data)`, where every
 * field on that route's schema is optional (rename OR toggle active OR
 * both, in one endpoint). A request body of `{}` (or one with only
 * unknown keys, which zod strips) is perfectly valid input as far as
 * `safeParse` is concerned — it just parses down to an empty object — but
 * `.set({})` produces an UPDATE with no columns to set, which Postgres
 * rejects, and nothing in these routes ever caught that: a genuine
 * request with nothing to change bubbled up as a raw, unhandled 500
 * instead of a clean "you didn't actually change anything" 400.
 *
 * Call this right after a successful `safeParse`, before the `.update()`
 * — returns a ready-to-return 400 response if there's really nothing to
 * update, or `null` if it's safe to proceed exactly as before.
 */
export function emptyUpdateGuard(data: object): NextResponse | null {
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'Nothing to update — include at least one field to change.' },
      { status: 400 },
    );
  }
  return null;
}
