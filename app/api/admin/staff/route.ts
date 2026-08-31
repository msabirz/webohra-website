import { NextResponse } from 'next/server';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { adminStaffInviteSchema } from '@/lib/validation';
import { getSessionFromRequest, isSuperAdmin } from '@/lib/auth';

/**
 * /api/admin/staff — super_admin only. Deliberately narrower than the rest
 * of the Admin Panel (see isSuperAdmin's comment in lib/auth.ts): granting
 * or revoking staff access is the one action a plain admin can't do to
 * itself or anyone else.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const staff = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      staffRole: users.staffRole,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(isNotNull(users.staffRole))
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ staff });
}

/**
 * POST /api/admin/staff — grants a role to an EXISTING account, found by
 * email. There's no transactional email sender wired up (see root
 * CLAUDE.md's tech stack), so this can't send an invite to someone who
 * hasn't signed up yet — she needs a WE Bohra account first (as a buyer or
 * seller; staff access layers on top, per the "role capabilities, not
 * exclusive" data model), then Admin promotes it here. For a genuinely new
 * hire with no account at all, use `npm run promote-staff` instead (see
 * scripts/promote-staff.ts), which can create one.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminStaffInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [existing] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!existing) {
    return NextResponse.json(
      {
        error:
          'No account found with that email — she needs to create a WE Bohra account first (as a buyer or seller), then you can grant her staff access.',
      },
      { status: 404 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({ staffRole: parsed.data.role })
    .where(eq(users.id, existing.id))
    .returning({ id: users.id, email: users.email, staffRole: users.staffRole });

  return NextResponse.json({ staff: updated }, { status: 201 });
}
