import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { jamaats } from '@/db/schema';

/**
 * GET /api/jamaats
 *
 * Public, read-only list of active jamaats for the seller registration
 * form's pickup-point picker (FR-46). Master data lives in the DB and is
 * curated via /api/admin/jamaats, not hardcoded — see db/schema.ts.
 */
export async function GET() {
  const list = await db
    .select({ id: jamaats.id, city: jamaats.city, name: jamaats.name })
    .from(jamaats)
    .where(eq(jamaats.active, true))
    .orderBy(asc(jamaats.city), asc(jamaats.name));

  return NextResponse.json({ jamaats: list });
}
