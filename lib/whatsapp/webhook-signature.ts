import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Meta's `X-Hub-Signature-256` header — HMAC-SHA256 of the raw
 * request body using the app's App Secret (Meta for Developers → app →
 * Settings → Basic — NOT the access token). Meta prefixes the header
 * value with "sha256=", unlike Razorpay's bare hex signature.
 */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');

  const bufExpected = Buffer.from(expected, 'hex');
  const bufProvided = Buffer.from(provided, 'hex');
  if (bufExpected.length !== bufProvided.length) return false;
  return timingSafeEqual(bufExpected, bufProvided);
}
