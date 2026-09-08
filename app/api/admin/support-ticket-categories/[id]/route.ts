import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { supportTicketCategories } from '@/db/schema';
import { adminSupportTicketCategoryUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { emptyUpdateGuard } from '@/lib/api-guards';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [existing] = await db.select().from(supportTicketCategories).where(eq(supportTicketCategories.id, Number(id)));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminSupportTicketCategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const emptyGuard = emptyUpdateGuard(parsed.data);
  if (emptyGuard) return emptyGuard;

  const [updated] = await db
    .update(supportTicketCategories)
    .set(parsed.data)
    .where(eq(supportTicketCategories.id, existing.id))
    .returning();

  return NextResponse.json({ category: updated });
}
