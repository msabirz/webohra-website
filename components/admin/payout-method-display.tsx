'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Landmark, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buildUpiDeepLink } from '@/lib/upi-qr';
import { Skeleton } from '@/components/skeleton';

type PayoutMethodData =
  | { method: 'upi'; payeeName: string; upi: { vpa: string } }
  | {
      method: 'bank_account';
      payeeName: string;
      bank: { accountHolderName: string; accountNumber: string; ifsc: string; bankName: string | null };
    };

/**
 * Shows Admin exactly how to actually pay a seller — Fulfillment &
 * Subscriptions redesign, Phase 5c payout redesign (2026-09-03, 'upi'/
 * 'bank_account' only as of the same-day removal of the 'qr_image'
 * method — it only duplicated what 'upi' already does for free). For
 * 'upi', builds a fresh QR code from the standard UPI deep-link format
 * with the exact payout amount baked in (see lib/upi-qr.ts) — any UPI app
 * pre-fills both the payee and amount the instant it's scanned, entirely
 * client-side, no gateway, no cost. For 'bank_account', shows what
 * GET /api/admin/sellers/[id]/payout-method fetched live from Razorpay
 * (never stored in our own database).
 */
export function PayoutMethodDisplay({ sellerId, amountRupees, orderNumber }: { sellerId: number; amountRupees: number; orderNumber: string }) {
  const [data, setData] = useState<PayoutMethodData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/admin/sellers/${sellerId}/payout-method`)
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? 'Could not load this seller\'s payout details.');
          return;
        }
        setData(json.account);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server.');
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  useEffect(() => {
    if (data?.method !== 'upi') return;
    const deepLink = buildUpiDeepLink({
      vpa: data.upi.vpa,
      payeeName: data.payeeName,
      amountRupees,
      note: `WE Bohra payout ${orderNumber}`,
    });
    QRCode.toDataURL(deepLink, { width: 240, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [data, amountRupees, orderNumber]);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 font-body text-xs text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
        {error}
      </div>
    );
  }

  if (data === undefined) return <Skeleton className="h-24" />;

  if (data === null) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-gold/10 px-3 py-2.5 font-body text-xs text-ink">
        <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
        This seller hasn&apos;t registered a payout method yet.
      </div>
    );
  }

  if (data.method === 'upi') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-ivory-deep/60 p-4">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="UPI payment QR code" className="h-48 w-48 rounded-lg bg-white p-2" />
        ) : (
          <Skeleton className="h-48 w-48" />
        )}
        <p className="font-body text-xs text-ink-soft">
          Scan with any UPI app — amount (₹{amountRupees.toLocaleString('en-IN')}) and payee fill in automatically.
        </p>
        <button
          onClick={() => copy(data.upi.vpa, 'vpa')}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-body text-xs font-medium text-ink shadow-sm ring-1 ring-ink-soft/10 hover:ring-navy/30"
        >
          {copied === 'vpa' ? <Check className="h-3.5 w-3.5 text-teal-deep" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
          {data.upi.vpa}
        </button>
      </div>
    );
  }

  // 'bank_account'
  const rows: [string, string][] = [
    ['Account holder', data.bank.accountHolderName],
    ['Account number', data.bank.accountNumber],
    ['IFSC', data.bank.ifsc],
    ...(data.bank.bankName ? ([['Bank', data.bank.bankName]] as [string, string][]) : []),
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-ivory-deep/60 p-4">
      <div className="flex items-center gap-2 font-body text-xs font-semibold text-ink-soft">
        <Landmark className="h-3.5 w-3.5" strokeWidth={2} />
        Pay via your own bank transfer (NEFT/IMPS)
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
          <div>
            <p className="font-body text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
            <p className="font-body text-sm font-medium text-ink">{value}</p>
          </div>
          <button
            onClick={() => copy(value, label)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-ivory-deep hover:text-navy"
            aria-label={`Copy ${label}`}
          >
            {copied === label ? <Check className="h-3.5 w-3.5 text-teal-deep" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        </div>
      ))}
      <p className="font-body text-xs text-ink-soft">Amount to send: ₹{amountRupees.toLocaleString('en-IN')}</p>
    </div>
  );
}
