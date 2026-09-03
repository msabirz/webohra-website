/**
 * UPI deep-link construction — Fulfillment & Subscriptions redesign,
 * Phase 5c (2026-09-03 payout redesign). The standard UPI intent URI
 * format ("upi://pay?pa=...") that every UPI app (GPay, PhonePe, Paytm,
 * BHIM, ...) already understands natively — not a Razorpay product
 * (Razorpay's own QR Code API generates a QR that credits WE Bohra's OWN
 * account, the wrong direction for a payout, and isn't enabled on this
 * merchant anyway), no gateway involved, no cost, nothing to get
 * approved. Built fresh at payout time with the exact amount baked in, so
 * scanning it in any UPI app pre-fills both the payee and the amount.
 * Rendering the actual QR code image from this string happens
 * client-side, in components/admin/payout-method-display.tsx, via the
 * `qrcode` package.
 */
export function buildUpiDeepLink(params: {
  vpa: string;
  payeeName: string;
  amountRupees: number;
  note: string;
}): string {
  const query = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    am: params.amountRupees.toFixed(2),
    cu: 'INR',
    tn: params.note,
  });
  return `upi://pay?${query.toString()}`;
}
