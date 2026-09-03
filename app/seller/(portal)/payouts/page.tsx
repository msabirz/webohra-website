'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton, Skeleton } from '@/components/skeleton';

type PayoutAccount = { method: 'bank_account' | 'upi'; displayLabel: string; updatedAt: string };
type PayoutStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'reversed';
type Payout = {
  id: number;
  orderNumber: string;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  status: PayoutStatus;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  processed: 'Paid out',
  failed: 'Failed',
  reversed: 'Reversed',
};
const STATUS_CLASS: Record<PayoutStatus, string> = {
  pending: 'bg-ivory-deep text-ink-soft',
  processing: 'bg-gold/15 text-gold-soft',
  processed: 'bg-teal/10 text-teal-deep',
  failed: 'bg-red-50 text-red-600',
  reversed: 'bg-red-50 text-red-600',
};
const STATUS_ICON: Record<PayoutStatus, typeof Clock> = {
  pending: Clock,
  processing: RefreshCw,
  processed: CheckCircle2,
  failed: XCircle,
  reversed: XCircle,
};

const EMPTY_BANK_FORM = { accountHolderName: '', ifsc: '', accountNumber: '' };

/**
 * /seller/payouts — Fulfillment & Subscriptions redesign, Phase 5c. Where
 * she registers where her online-order earnings go (real RazorpayX contact
 * + fund account, created the moment she saves this — see
 * POST /api/sellers/payout-account), and sees the history of what's been
 * computed/sent for her paid online orders. Actually receiving money
 * depends on RAZORPAYX_ACCOUNT_NUMBER being configured platform-wide — if
 * it isn't yet, her payouts sit at "Pending" (never silently claimed as
 * paid) until it is.
 */
export default function SellerPayoutsPage() {
  const [account, setAccount] = useState<PayoutAccount | null | undefined>(undefined);
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<'bank_account' | 'upi'>('bank_account');
  const [bankForm, setBankForm] = useState(EMPTY_BANK_FORM);
  const [vpa, setVpa] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [accountRes, payoutsRes] = await Promise.all([
      authFetch('/api/sellers/payout-account'),
      authFetch('/api/sellers/payouts'),
    ]);
    const accountData = await accountRes.json();
    const payoutsData = await payoutsRes.json();
    setAccount(accountData.account);
    setPayouts(payoutsData.payouts ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const body =
        method === 'bank_account' ? { method, ...bankForm } : { method, vpa };
      const res = await authFetch('/api/sellers/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          const errs: Record<string, string> = {};
          for (const key of Object.keys(data.issues)) errs[key] = data.issues[key]?.[0];
          setFieldErrors(errs);
        } else {
          setError(data.error ?? 'Could not save your payout details.');
        }
        return;
      }
      setEditing(false);
      setBankForm(EMPTY_BANK_FORM);
      setVpa('');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Payouts</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Where your online-order earnings go, and the record of what&apos;s been sent.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="font-heading text-lg font-semibold text-ink">Payout account</h2>

        {account === undefined ? (
          <Skeleton className="h-16" />
        ) : account && !editing ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ivory-deep/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy/5">
                <Landmark className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-body text-sm font-medium text-ink">{account.displayLabel}</p>
                <p className="font-body text-xs text-ink-soft">
                  {account.method === 'bank_account' ? 'Bank account' : 'UPI'}
                </p>
              </div>
            </div>
            <button onClick={() => setEditing(true)} className={buttonStyles('secondary', 'sm')}>
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 rounded-full bg-ivory-deep p-1.5 w-fit">
              {(['bank_account', 'upi'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                    method === m ? 'bg-navy text-ivory' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {m === 'bank_account' ? 'Bank account' : 'UPI'}
                </button>
              ))}
            </div>

            {method === 'bank_account' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="payout-holder" className="font-body text-xs font-medium text-ink-soft">
                    Account holder name
                  </label>
                  <input
                    id="payout-holder"
                    value={bankForm.accountHolderName}
                    onChange={(e) => setBankForm((prev) => ({ ...prev, accountHolderName: e.target.value }))}
                    className={inputStyles}
                  />
                  {fieldErrors.accountHolderName && (
                    <p className="font-body text-xs text-red-700">{fieldErrors.accountHolderName}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="payout-ifsc" className="font-body text-xs font-medium text-ink-soft">
                    IFSC
                  </label>
                  <input
                    id="payout-ifsc"
                    value={bankForm.ifsc}
                    onChange={(e) => setBankForm((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                    placeholder="HDFC0000053"
                    className={inputStyles}
                  />
                  {fieldErrors.ifsc && <p className="font-body text-xs text-red-700">{fieldErrors.ifsc}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="payout-account-number" className="font-body text-xs font-medium text-ink-soft">
                    Account number
                  </label>
                  <input
                    id="payout-account-number"
                    value={bankForm.accountNumber}
                    onChange={(e) =>
                      setBankForm((prev) => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '') }))
                    }
                    className={inputStyles}
                  />
                  {fieldErrors.accountNumber && (
                    <p className="font-body text-xs text-red-700">{fieldErrors.accountNumber}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 sm:w-64">
                <label htmlFor="payout-vpa" className="font-body text-xs font-medium text-ink-soft">
                  UPI ID
                </label>
                <input
                  id="payout-vpa"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  placeholder="name@bank"
                  className={inputStyles}
                />
                {fieldErrors.vpa && <p className="font-body text-xs text-red-700">{fieldErrors.vpa}</p>}
              </div>
            )}

            {error && <p className="font-body text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
              <button onClick={submit} disabled={submitting} className={buttonStyles('primary', 'sm')}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
              {account && (
                <button onClick={() => setEditing(false)} className={buttonStyles('secondary', 'sm')}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {!account && account !== undefined && !editing && (
          <p className="font-body text-xs text-ink-soft">
            Add your bank account or UPI ID above so a paid online order can actually pay you.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-ink">Payout history</h2>
        {payouts === null ? (
          <RowListSkeleton count={3} />
        ) : payouts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-soft/5">
            <Landmark className="h-7 w-7 text-ink-soft/40" strokeWidth={1.5} />
            <p className="font-body text-sm text-ink-soft">No payouts yet — these appear once an online order is paid.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-2 py-3 font-medium">Gross</th>
                  <th className="px-2 py-3 font-medium">Commission</th>
                  <th className="px-2 py-3 font-medium">Net</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => {
                  const Icon = STATUS_ICON[p.status];
                  return (
                    <tr key={p.id} className="border-b border-ink-soft/5 last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{p.orderNumber}</td>
                      <td className="px-2 py-3 tabular-nums text-ink-soft">₹{Number(p.grossAmount).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-3 tabular-nums text-ink-soft">−₹{Number(p.commissionAmount).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-3 font-medium tabular-nums text-ink">₹{Number(p.netAmount).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[p.status]}`}
                          title={p.failureReason ?? undefined}
                        >
                          <Icon className="h-3 w-3" strokeWidth={2} />
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-ink-soft">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
