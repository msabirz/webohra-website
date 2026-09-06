import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { supportTicketCategories } from '@/db/schema';
import { adminSupportTicketCategoryCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await db
    .select()
    .from(supportTicketCategories)
    .orderBy(asc(supportTicketCategories.sortOrder), asc(supportTicketCategories.name));
  return NextResponse.json({ categories: list });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSupportTicketCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(supportTicketCategories)
    .where(eq(supportTicketCategories.key, parsed.data.key));
  if (existing) {
    return NextResponse.json(
      { error: 'Invalid input', issues: { key: ['A category with this key already exists'] } },
      { status: 400 },
    );
  }

  const [category] = await db.insert(supportTicketCategories).values(parsed.data).returning();
  return NextResponse.json({ category }, { status: 201 });
}
