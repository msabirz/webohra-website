import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Razorpay integration — Fulfillment & Subscriptions redesign, Phase 5.
 * Deliberately a thin wrapper over Razorpay's plain REST API (Basic auth
 * with key_id:key_secret) rather than their Node SDK — same "fetch +
 * crypto, no vendor SDK" pattern as lib/otp/provider.ts's MSG91 client.
 * Sandbox/test-mode keys only for now (RAZORPAY_KEY_ID starts "rzp_test_");
 * swapping to live keys later is purely an env change, no code change.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set');
  }
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

/** The publishable key the frontend checkout widget needs — safe to expose,
 *  unlike the secret. Kept here so nothing outside this file ever reaches
 *  into process.env.RAZORPAY_KEY_ID directly. */
export function getRazorpayKeyId(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) throw new Error('RAZORPAY_KEY_ID is not set');
  return keyId;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

/**
 * Creates a Razorpay order — the first step of any payment (wallet top-up
 * today; buyer checkout in the next slice of this phase). `amountRupees` is
 * converted to paise here so every caller works in real rupees, matching
 * every other money value in this codebase (numeric(10,2) columns, never
 * paise) right up to the one boundary that actually needs paise.
 */
export async function createRazorpayOrder(params: {
  amountRupees: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(params.amountRupees * 100),
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Razorpay order creation failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Fetches an order back from Razorpay by id — used by the verify endpoint
 * to read the order's own `notes.sellerId` as the authoritative source of
 * who a payment belongs to, rather than trusting whichever session happens
 * to call verify with a given order/payment id pair. The signature alone
 * proves the payment is genuine; it doesn't prove it belongs to the caller.
 */
export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder & { notes?: Record<string, string> }> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders/${orderId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Razorpay order fetch failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Verifies the signature Razorpay's checkout widget hands back on the
 * client after a successful payment — HMAC-SHA256 of "order_id|payment_id"
 * using the key secret, exactly as Razorpay's docs specify. This is what
 * stops a browser from just calling the verify endpoint with a made-up
 * payment id and crediting a wallet for free.
 */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET is not set');

  const expected = createHmac('sha256', keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  return safeEqualHex(expected, params.signature);
}

/**
 * Verifies the `X-Razorpay-Signature` header on an incoming webhook —
 * HMAC-SHA256 of the raw request body using the separate webhook secret
 * (never the key secret). Must run against the untouched raw body, before
 * any JSON parsing, since re-serializing would produce different bytes.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set');

  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
