import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/db/index';
import { banners } from '@/db/schema';
import { adminBannerCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

/**
 * /api/admin/banners — Admin-curated homepage slider (explicitly NOT
 * seller-managed, per the requester).
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder));
  return NextResponse.json({ banners: rows });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminBannerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [banner] = await db.insert(banners).values(parsed.data).returning();
  return NextResponse.json({ banner }, { status: 201 });
}
