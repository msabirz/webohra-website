import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { sellerItsCardSubmitSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/sellers/its-card — item 37 (2026-09-08). Attach (or replace)
 * an optional photo of her ITS card, uploaded via
 * POST /api/uploads/presign (purpose: 'its_card') beforehand — this route
 * only ever receives the resulting public URL, never the file itself.
 *
 * Deliberately does NOT touch itsId or itsVerified — the number itself
 * is still the thing an admin actually verifies (unchanged since before
 * this existed); this is purely supporting visual evidence she can
 * optionally attach, and something for admin to glance at during review.
 * Uploading a new photo never resets an existing itsVerified: true —
 * unlike the GST/Udyam flow, there's no separate "resubmission" state
 * machine here, just one photo that can be replaced.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerItsCardSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({ itsCardImageUrl: parsed.data.itsCardImageUrl })
    .where(eq(users.id, Number(session.sub)))
    .returning({ itsCardImageUrl: users.itsCardImageUrl });

  return NextResponse.json({ itsCardImageUrl: updated.itsCardImageUrl });
}
