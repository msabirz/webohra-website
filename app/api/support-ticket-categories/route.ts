import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { supportTicketCategories } from '@/db/schema';

/** Public — only active categories, for the /contact form's dropdown. */
export async function GET() {
  const list = await db
    .select({ id: supportTicketCategories.id, name: supportTicketCategories.name })
    .from(supportTicketCategories)
    .where(eq(supportTicketCategories.active, true))
    .orderBy(asc(supportTicketCategories.sortOrder));
  return NextResponse.json({ categories: list });
}
