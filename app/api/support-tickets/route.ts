import { NextResponse } from 'next/server';
import { db } from '@/db/index';
import { supportTickets } from '@/db/schema';
import { supportTicketCreateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/support-tickets — what actually makes /contact real
 * (2026-09-06, marketplace-completeness scan), instead of a bare display
 * email. No account required, same as /contact never required one —
 * `createdByUserId` is set only if she happens to be logged in when she
 * submits.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = supportTicketCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const session = await getSessionFromRequest(request);
  const { email, phone, ...rest } = parsed.data;

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      ...rest,
      email: email || null,
      phone: phone || null,
      createdByUserId: session ? Number(session.sub) : null,
    })
    .returning();

  return NextResponse.json({ ticket }, { status: 201 });
}
