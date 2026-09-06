import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { whatsappMessages } from '@/db/schema';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';
import { billConnectMessage } from '@/lib/whatsapp-connect';

/**
 * GET /api/webhooks/whatsapp — Meta's one-time verification handshake,
 * run automatically the moment you paste this URL into WhatsApp →
 * Configuration → Webhook in the Meta for Developers dashboard. Meta
 * calls this with hub.mode=subscribe, hub.verify_token (whatever string
 * you set there), and hub.challenge (a random value) — echoing the
 * challenge back, only if the token matches, proves you control this URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp — Meta's server calling us directly with
 * message status updates (sent/delivered/read/failed) and incoming
 * replies, keyed by the wamid this app got back when it sent the
 * original message (see lib/whatsapp/meta-cloud-api.ts). This is the
 * ONLY source of truth for whether a WhatsApp Connect was genuine — never
 * self-reported by the buyer or seller.
 *
 * An incoming message (the recipient actually replying) is the strongest
 * possible signal — stronger than a delivered/read receipt, since a
 * reply proves a real two-way conversation started, not just that the
 * message reached her phone. Treated here as an implicit "read".
 *
 * Must read the raw body before JSON parsing — same reason as the
 * Razorpay webhook: the signature is computed over the exact bytes sent.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const payload = JSON.parse(rawBody || '{}');

  const changes = payload?.entry?.flatMap((entry: { changes?: unknown[] }) => entry.changes ?? []) ?? [];

  for (const change of changes) {
    const value = change?.value;
    if (!value) continue;

    // Delivery/read/failed status updates for a message this app sent.
    for (const status of value.statuses ?? []) {
      const waMessageId: string | undefined = status.id;
      const newStatus: string | undefined = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
      if (!waMessageId || !newStatus) continue;

      const failureReason =
        newStatus === 'failed' ? (status.errors?.[0]?.title ?? status.errors?.[0]?.message ?? 'Unknown error') : null;

      await db
        .update(whatsappMessages)
        .set({
          status: newStatus as 'sent' | 'delivered' | 'read' | 'failed',
          statusUpdatedAt: new Date(),
          ...(failureReason ? { failureReason } : {}),
        })
        .where(eq(whatsappMessages.waMessageId, waMessageId));

      // WhatsApp Connect billing (Tier 3, item 19, 2026-09-06) — the ₹20
      // charge fires here, the moment delivery/read is genuinely
      // confirmed, never on send. billConnectMessage is a no-op for a
      // message that isn't a Connect notification at all (e.g. the POC's
      // hello_world sends have no sellerId) or one already billed.
      if (newStatus === 'delivered' || newStatus === 'read') {
        await billConnectMessage(waMessageId);
      }
    }

    // A real reply — the recipient actually messaged back. Matched by
    // phone number since a reply carries no wamid pointing back to our
    // original outbound message. Treated as an implicit "read" — see
    // this route's own top comment — and billable the same way (fixed
    // 2026-09-06 alongside the WhatsApp Connect billing wiring: this
    // used to sort ascending and take the OLDEST message to that phone,
    // not the most recent one, which would have both updated and billed
    // the wrong row).
    for (const incoming of value.messages ?? []) {
      const fromPhone: string | undefined = incoming.from;
      if (!fromPhone) continue;

      const [mostRecent] = await db
        .select({ id: whatsappMessages.id, waMessageId: whatsappMessages.waMessageId })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.toPhone, fromPhone))
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(1);

      if (mostRecent) {
        await db
          .update(whatsappMessages)
          .set({ status: 'read', statusUpdatedAt: new Date() })
          .where(eq(whatsappMessages.id, mostRecent.id));
        if (mostRecent.waMessageId) {
          await billConnectMessage(mostRecent.waMessageId);
        }
      }
    }
  }

  // Meta expects a fast 200 regardless of what was inside — it retries
  // with backoff on anything else, which would just resend the same
  // events repeatedly.
  return NextResponse.json({ received: true });
}
