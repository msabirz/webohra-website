import { NextResponse } from 'next/server';
import { isNotNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/**
 * GET /api/admin/staff-directory — a lightweight, any-staff-readable list
 * of who exists to assign a dispute to (Admin Panel transaction/dispute/
 * refund tooling, 2026-09-03). Deliberately separate from GET
 * /api/admin/staff, which is isSuperAdmin-only and carries the fuller
 * staff-management payload — any staff member needs to be able to assign
 * a dispute to any other staff member, not just a super_admin managing
 * accounts, so this route stays isStaff and returns only what a dropdown
 * needs.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const staff = await db
    .select({ id: users.id, name: users.name, email: users.email, staffRole: users.staffRole })
    .from(users)
    .where(isNotNull(users.staffRole));

  return NextResponse.json({ staff });
}
