import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/db/index';
import { legalPages } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await db.select().from(legalPages).orderBy(asc(legalPages.title));
  return NextResponse.json({ pages: list });
}
