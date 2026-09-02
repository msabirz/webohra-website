'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight, Settings2 } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton, RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type SellerMeta = { name: string | null; email: string | null; phone: string; businessName: string | null };
type WalletTransaction = {
  id: number;
  type: 'topup' | 'commission_deduction' | 'admin_adjustment';
  amount: string;
  balanceAfter: string;
  reason: string | null;
  gatewayPaymentId: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<WalletTransaction['type'], string> = {
  topup: 'Top-up',
  commission_deduction: 'Commission',
  admin_adjustment: 'Admin adjustment',
};

/**
 * /admin/wallets/[sellerId] — one seller's full wallet picture. Any staff
 * role can view (Customer Support's own tooling — looking things up to
 * help with a query); only Admin/Super Admin can actually adjust a balance
 * (canAdjust below), matching the server-side isAdmin gate on the adjust
 * endpoint — this is a UI convenience, not the real enforcement.
 */
export default function AdminWalletDetailPage() {
  const params = useParams<{ sellerId: string }>();
  const { me } = useAdminPortal();
  const canAdjust = me.staffRole === 'admin' || me.staffRole === 'super_admin';

  const [seller, setSeller] = useState<SellerMeta | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await authFetch(`/api/admin/wallets/${params.sellerId}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setSeller(data.seller);
    setBalance(data.wallet.balance);
    setTransactions(data.transactions);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sellerId]);

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const amountRupees = Number(amount);
    if (!amount || Number.isNaN(amountRupees) || amountRupees === 0) {
      setError("Enter a non-zero amount — negative to deduct, positive to add.");
      return;
    }
    if (reason.trim().length < 5) {
      setError('Explain the reason for this adjustment.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/admin/wallets/${params.sellerId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRupees, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.amountRupees?.[0] ?? data.issues?.reason?.[0] ?? data.error ?? 'Could not save the adjustment.');
        return;
      }
      setAmount('');
      setReason('');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return <p className="font-body text-sm text-ink-soft">Seller not found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/wallets"
          className="mb-2 inline-flex items-center gap-1.5 font-body text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Wallets
        </Link>
        {seller ? (
          <>
            <h1 className="font-heading text-2xl font-semibold text-ink">
              {seller.businessName ?? seller.name ?? seller.email ?? seller.phone}
            </h1>
            <p className="mt-1 font-body text-sm text-ink-soft">
              {seller.name ?? '—'} · {seller.email ?? '—'} · {seller.phone}
            </p>
          </>
        ) : (
          <Skeleton className="h-8 w-64" />
        )}
      </div>

      {balance === null ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-navy p-6 text-ivory shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <Wallet className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-ivory/60">Current balance</p>
            <p className="font-heading text-2xl font-semibold">₹{Number(balance).toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {canAdjust && (
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="font-heading text-lg font-semibold text-ink">Manual adjustment</h2>
          <p className="font-body text-xs text-ink-soft">
            The only way a balance moves outside a real Razorpay top-up — always logged with your name and a reason.
          </p>
          <form onSubmit={submitAdjustment} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="adjust-amount" className="font-body text-xs font-medium text-ink-soft">
                Amount (₹, negative to deduct)
              </label>
              <input
                id="adjust-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. -150 or 500"
                className={`${inputStyles} w-full sm:w-40`}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="adjust-reason" className="font-body text-xs font-medium text-ink-soft">
                Reason
              </label>
              <input
                id="adjust-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Refund for a failed Delhivery pickup, ref WB260812-AB3XY"
                className={`${inputStyles} w-full`}
              />
            </div>
            <button disabled={submitting} type="submit" className={buttonStyles('primary', 'md')}>
              {submitting ? 'Saving…' : 'Apply adjustment'}
            </button>
          </form>
          {error && <p className="font-body text-sm text-red-700">{error}</p>}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-ink">Transaction history</h2>
        {transactions === null ? (
          <RowListSkeleton count={4} />
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-soft/5">
            <Wallet className="h-7 w-7 text-ink-soft/40" strokeWidth={1.5} />
            <p className="font-body text-sm text-ink-soft">No transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Balance after</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isCredit = Number(t.amount) >= 0;
                  return (
                    <tr key={t.id} className="border-b border-ink-soft/5 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t.type === 'admin_adjustment' ? (
                            <Settings2 className="h-3.5 w-3.5 text-ink-soft" strokeWidth={2} />
                          ) : isCredit ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-teal-deep" strokeWidth={2} />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-600" strokeWidth={2} />
                          )}
                          {TYPE_LABEL[t.type]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium tabular-nums ${isCredit ? 'text-teal-deep' : 'text-red-600'}`}>
                        {isCredit ? '+' : '−'}₹{Math.abs(Number(t.amount)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">
                        ₹{Number(t.balanceAfter).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {t.reason ?? (t.gatewayPaymentId ? `Razorpay ${t.gatewayPaymentId}` : '—')}
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
