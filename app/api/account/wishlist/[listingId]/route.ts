import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { wishlistItems } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to manage your saved listings' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const { listingId } = await params;
  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.listingId, Number(listingId))));
  return NextResponse.json({ ok: true });
}
