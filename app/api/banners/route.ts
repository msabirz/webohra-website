import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { banners } from '@/db/schema';

/** GET /api/banners — public, active-only, for the homepage hero slider. */
export async function GET() {
  const rows = await db
    .select()
    .from(banners)
    .where(eq(banners.active, true))
    .orderBy(asc(banners.sortOrder));

  return NextResponse.json({ banners: rows });
}
