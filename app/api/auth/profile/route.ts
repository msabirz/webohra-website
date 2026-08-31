import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { profileUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/** PATCH /api/auth/profile — update the signed-in user's own name/email. */
export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (parsed.data.email) {
    const [taken] = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (taken && taken.id !== Number(session.sub)) {
      return NextResponse.json(
        { error: 'That email is already in use', issues: { email: ['Already in use'] } },
        { status: 409 },
      );
    }
  }

  const [user] = await db
    .update(users)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}),
    })
    .where(eq(users.id, Number(session.sub)))
    .returning();

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      name: user.name,
      email: user.email,
      hasPassword: !!user.passwordHash,
      itsVerified: user.itsVerified,
      staffRole: user.staffRole,
    },
  });
}
