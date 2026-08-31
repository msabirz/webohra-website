import { NextResponse } from 'next/server';
import { count, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { adminStaffUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isSuperAdmin } from '@/lib/auth';

/**
 * PATCH /api/admin/staff/[userId] — super_admin only. Changes or revokes
 * (role: null) a staff member's access. Refuses to demote/revoke the last
 * remaining super_admin — including from herself — so the platform can
 * never end up with zero accounts able to manage staff at all.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;
  const id = Number(userId);

  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminStaffUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (target.staffRole === 'super_admin' && parsed.data.role !== 'super_admin') {
    const [{ superAdminCount }] = await db
      .select({ superAdminCount: count() })
      .from(users)
      .where(eq(users.staffRole, 'super_admin'));
    if (superAdminCount <= 1) {
      return NextResponse.json(
        { error: "Can't remove the last super_admin — promote another account first." },
        { status: 409 },
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({ staffRole: parsed.data.role })
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, staffRole: users.staffRole });

  return NextResponse.json({ staff: updated });
}
