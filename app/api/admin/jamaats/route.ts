import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/db/index';
import { jamaats } from '@/db/schema';
import { adminJamaatCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

/**
 * /api/admin/jamaats — Admin-curated master list (FR-46/47): the fixed set
 * of pickup points a Delhivery-managed seller can choose as her origin.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await db.select().from(jamaats).orderBy(asc(jamaats.city), asc(jamaats.name));
  return NextResponse.json({ jamaats: list });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminJamaatCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [jamaat] = await db.insert(jamaats).values(parsed.data).returning();
  return NextResponse.json({ jamaat }, { status: 201 });
}
