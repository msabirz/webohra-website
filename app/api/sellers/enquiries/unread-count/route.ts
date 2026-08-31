import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/** GET /api/sellers/enquiries/unread-count — the bell icon's badge number:
 *  requests she hasn't opened yet ('initiated', viewedAt still null). */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const [{ unread }] = await db
    .select({ unread: count() })
    .from(enquiries)
    .where(and(eq(enquiries.sellerId, Number(session.sub)), eq(enquiries.status, 'initiated')));

  return NextResponse.json({ unread });
}
