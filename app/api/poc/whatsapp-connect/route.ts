import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/index';
import { whatsappMessages } from '@/db/schema';
import { getWhatsAppProvider } from '@/lib/whatsapp';

/**
 * TEMPORARY POC route (2026-09-05) — simulates what a real "WhatsApp
 * Connect" click would trigger: send a template message through the
 * WhatsApp Business Platform and track its real delivery status, instead
 * of the untracked wa.me deep link the live product uses today. See
 * [[webohra-fulfillment-subscriptions-phases]] for the full writeup on
 * why this can't simply replace the existing direct-connect flow as-is
 * (Meta requires a dedicated number, not a seller's personal one).
 *
 * Delete this route (and app/seller/whatsapp-poc) once the POC has
 * answered the real question — can genuine delivery/read status be
 * tracked at all — and a real product decision is made about the
 * masked-relay redesign this implies.
 *
 * `hello_world` is Meta's own pre-approved sample template, available on
 * every fresh WhatsApp Business Account with zero setup — good enough to
 * prove the send→status pipeline works before spending time getting a
 * real WE-Bohra template approved.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const toPhone = body?.toPhone;
  if (!toPhone || typeof toPhone !== 'string') {
    return NextResponse.json({ error: 'toPhone is required (a number you added as a verified test recipient)' }, { status: 400 });
  }

  const provider = getWhatsAppProvider();
  const result = await provider.sendTemplateMessage(toPhone, 'hello_world', []);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const [message] = await db
    .insert(whatsappMessages)
    .values({
      toPhone,
      waMessageId: result.waMessageId,
      status: provider.isDev ? 'sent' : 'queued',
    })
    .returning();

  return NextResponse.json({ message, isDev: provider.isDev });
}

/** Poll the most recent POC message's live status — the demo page uses
 *  this to show sent → delivered → read as real webhook events land. */
export async function GET() {
  const [message] = await db.select().from(whatsappMessages).orderBy(desc(whatsappMessages.id)).limit(1);
  return NextResponse.json({ message: message ?? null });
}
