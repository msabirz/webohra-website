import { db } from '@/db/index';
import { notifications } from '@/db/schema';
import { getNotificationProvider } from './index';

/**
 * The one place any notification actually gets sent + logged — every
 * trigger in lib/notifications/triggers.ts funnels through this rather
 * than calling the provider directly, so the "one audit row per
 * channel per attempt" rule (see notifications' own schema comment)
 * can't be forgotten at a call site. Never throws: a notification
 * failure must never block the real action that triggered it (an order
 * still succeeds even if the confirmation email doesn't send) — a
 * failure is recorded as a 'failed' row instead, not swallowed silently.
 * Either `email` or `phone` (or both) may be null/omitted — a guest
 * order with no email on file, for instance, still gets the SMS.
 */
export async function sendNotification(params: {
  event: string;
  relatedId?: number;
  email?: string | null;
  phone?: string | null;
  subject: string;
  emailBody: string;
  smsBody: string;
}) {
  const provider = getNotificationProvider();

  if (params.email) {
    try {
      await provider.sendEmail(params.email, params.subject, params.emailBody);
      await db.insert(notifications).values({
        channel: 'email',
        recipient: params.email,
        subject: params.subject,
        body: params.emailBody,
        event: params.event,
        relatedId: params.relatedId ?? null,
        status: 'sent',
      });
    } catch (err) {
      await db.insert(notifications).values({
        channel: 'email',
        recipient: params.email,
        subject: params.subject,
        body: params.emailBody,
        event: params.event,
        relatedId: params.relatedId ?? null,
        status: 'failed',
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  if (params.phone) {
    try {
      await provider.sendSms(params.phone, params.smsBody);
      await db.insert(notifications).values({
        channel: 'sms',
        recipient: params.phone,
        body: params.smsBody,
        event: params.event,
        relatedId: params.relatedId ?? null,
        status: 'sent',
      });
    } catch (err) {
      await db.insert(notifications).values({
        channel: 'sms',
        recipient: params.phone,
        body: params.smsBody,
        event: params.event,
        relatedId: params.relatedId ?? null,
        status: 'failed',
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
