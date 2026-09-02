import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/db/index';
import { webohraOffices } from '@/db/schema';
import { adminWebohraOfficeCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

/**
 * /api/admin/webohra-offices — the volunteer-staffed locations WeBohra
 * itself runs, distinct from a jamaat (see webohraOffices' own comment in
 * db/schema.ts). Admin maps jamaats to one of these; sellers/buyers never
 * see this list directly, only the resolved address on a shipment/pickup.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await db.select().from(webohraOffices).orderBy(asc(webohraOffices.city), asc(webohraOffices.name));
  return NextResponse.json({ offices: list });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminWebohraOfficeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [office] = await db.insert(webohraOffices).values(parsed.data).returning();
  return NextResponse.json({ office }, { status: 201 });
}
