'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Landmark, CheckCircle2, Clock, XCircle, RefreshCw, Store } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { TableSkeleton, RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type PayoutStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'reversed';
type Payout = {
  id: number;
  orderNumber: string;
  sellerId: number;
  businessName: string | null;
  sellerName: string | null;
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

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processed', label: 'Paid out' },
  { key: 'failed', label: 'Failed' },
] as const;

type SellerGroup = {
  sellerId: number;
  label: string;
  pendingCount: number;
  pendingAmount: number;
  processedAmount: number;
};

/**
 * /admin/payouts — Fulfillment & Subscriptions redesign, Phase 5c. Every
 * payout row, computed automatically the moment an online order is paid
 * (see lib/payouts.ts's createPayoutsForOrder). "Send" triggers the real
 * RazorpayX transfer — isAdmin only (see the send endpoint's own comment);
 * Customer Support can view this page but the button is hidden for her,
 * matching the server-side gate.
 *
 * The "By seller" view exists specifically for the multi-seller-cart
 * case: one order can produce several payout rows (one per seller), and a
 * seller who shows up across several such orders can end up with several
 * pending rows scattered through the "By order" list — "Pay all pending"
 * clears every one of them for her in a single click (see
 * POST /api/admin/payouts/sellers/[sellerId]/send-all), rather than
 * requiring Admin to hunt each row down individually.
 */
export default function AdminPayoutsPage() {
  const { me } = useAdminPortal();
  const canSend = me.staffRole === 'admin' || me.staffRole === 'super_admin';

  const [view, setView] = useState<'orders' | 'sellers'>('orders');
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [sendingId, setSendingId] = useState<number | `seller-${number}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPayouts(null);
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    const res = await authFetch(`/api/admin/payouts?${params}`);
    const data = await res.json();
    setPayouts(data.payouts ?? []);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(id: number) {
    setSendingId(id);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/payouts/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send this payout.');
      }
      await load();
    } finally {
      setSendingId(null);
    }
  }

  async function sendAllForSeller(sellerId: number) {
    setSendingId(`seller-${sellerId}`);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/payouts/sellers/${sellerId}/send-all`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send these payouts.');
      } else if (data.failed > 0) {
        setError(`${data.sent} sent, ${data.failed} failed — check the order-by-order view for details.`);
      }
      await load();
    } finally {
      setSendingId(null);
    }
  }

  // Grouping the already-loaded flat list client-side, since the same
  // data (whatever the current status filter shows) drives both views —
  // no separate endpoint needed just to re-shape it.
  const bySeller = useMemo<SellerGroup[]>(() => {
    if (!payouts) return [];
    const map = new Map<number, SellerGroup>();
    for (const p of payouts) {
      const existing = map.get(p.sellerId) ?? {
        sellerId: p.sellerId,
        label: p.businessName ?? p.sellerName ?? `Seller #${p.sellerId}`,
        pendingCount: 0,
        pendingAmount: 0,
        processedAmount: 0,
      };
      if (p.status === 'pending' || p.status === 'failed') {
        existing.pendingCount += 1;
        existing.pendingAmount += Number(p.netAmount);
      } else if (p.status === 'processed') {
        existing.processedAmount += Number(p.netAmount);
      }
      map.set(p.sellerId, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [payouts]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Payouts</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Every seller&apos;s share of a paid online order, and what&apos;s actually been sent.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5 w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                filter === f.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 rounded-full bg-ivory-deep p-1.5 w-fit">
          {(['orders', 'sellers'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                view === v ? 'bg-navy text-ivory' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {v === 'orders' ? 'By order' : 'By seller'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="font-body text-sm text-red-700">{error}</p>}

      {view === 'sellers' ? (
        payouts === null ? (
          <RowListSkeleton count={3} />
        ) : bySeller.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
            <Store className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
            <p className="font-body text-sm text-ink-soft">No sellers match.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {bySeller.map((s) => (
              <div
                key={s.sellerId}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/admin/sellers/${s.sellerId}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
                    <Store className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-ink">{s.label}</p>
                    <p className="font-body text-xs text-ink-soft">
                      {s.pendingCount > 0
                        ? `${s.pendingCount} order${s.pendingCount === 1 ? '' : 's'} pending`
                        : 'Nothing pending'}
                      {s.processedAmount > 0 && ` · ₹${s.processedAmount.toLocaleString('en-IN')} paid out`}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {s.pendingAmount > 0 && (
                    <span className="font-body text-sm font-semibold text-navy">
                      ₹{s.pendingAmount.toLocaleString('en-IN')} pending
                    </span>
                  )}
                  {canSend && s.pendingAmount > 0 && (
                    <button
                      onClick={() => sendAllForSeller(s.sellerId)}
                      disabled={sendingId !== null}
                      className={buttonStyles('primary', 'sm')}
                    >
                      {sendingId === `seller-${s.sellerId}`
                        ? 'Sending…'
                        : `Pay ₹${s.pendingAmount.toLocaleString('en-IN')}`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : payouts === null ? (
        <TableSkeleton rows={4} />
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Landmark className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No payouts match.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
          <table className="w-full min-w-[720px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Order</th>
                <th className="px-2 py-3">Seller</th>
                <th className="px-2 py-3">Gross</th>
                <th className="px-2 py-3">Commission</th>
                <th className="px-2 py-3">Net</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const Icon = STATUS_ICON[p.status];
                return (
                  <tr key={p.id} className="border-b border-ink-soft/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{p.orderNumber}</td>
                    <td className="px-2 py-3 text-ink-soft">{p.businessName ?? p.sellerName ?? `#${p.sellerId}`}</td>
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
                      {p.status === 'failed' && p.failureReason && (
                        <p className="mt-1 max-w-[220px] font-body text-[11px] text-red-600">{p.failureReason}</p>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {canSend && (p.status === 'pending' || p.status === 'failed') && (
                        <button
                          onClick={() => send(p.id)}
                          disabled={sendingId === p.id}
                          className={buttonStyles('secondary', 'sm')}
                        >
                          {sendingId === p.id ? 'Sending…' : p.status === 'failed' ? 'Retry' : 'Send'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
