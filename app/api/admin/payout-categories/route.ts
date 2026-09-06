import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { payoutCategories } from '@/db/schema';
import { adminPayoutCategoryCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

/**
 * /api/admin/payout-categories — the admin-manageable "why does this
 * payout exist" tags (2026-09-06, see payoutCategories' own comment in
 * db/schema.ts). Same shape as /api/admin/webohra-offices: a flat,
 * archive-don't-delete lookup list any admin can read, only an admin can
 * add to.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await db
    .select()
    .from(payoutCategories)
    .orderBy(asc(payoutCategories.sortOrder), asc(payoutCategories.name));
  return NextResponse.json({ categories: list });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminPayoutCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [existing] = await db.select().from(payoutCategories).where(eq(payoutCategories.key, parsed.data.key));
  if (existing) {
    return NextResponse.json(
      { error: 'Invalid input', issues: { key: ['A category with this key already exists'] } },
      { status: 400 },
    );
  }

  const [category] = await db.insert(payoutCategories).values(parsed.data).returning();
  return NextResponse.json({ category }, { status: 201 });
}
