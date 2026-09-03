'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Landmark, CheckCircle2, Clock, XCircle, RefreshCw, Store, Wallet2, HandCoins } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { TableSkeleton, RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type PayoutStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'reversed';
type PayoutChannel = 'razorpayx' | 'manual' | null;
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
  channel: PayoutChannel;
  manualNote: string | null;
  processedAt: string | null;
  createdAt: string;
};

const STATUS_ICON: Record<PayoutStatus, typeof Clock> = {
  pending: Clock,
  processing: RefreshCw,
  processed: CheckCircle2,
  failed: XCircle,
  reversed: XCircle,
};
const STATUS_CLASS: Record<PayoutStatus, string> = {
  pending: 'bg-ivory-deep text-ink-soft',
  processing: 'bg-gold/15 text-gold-soft',
  processed: 'bg-teal/10 text-teal-deep',
  failed: 'bg-red-50 text-red-600',
  reversed: 'bg-red-50 text-red-600',
};

/** Label always names the real channel once one exists — "Paid out"
 *  alone would leave a non-technical admin guessing whether RazorpayX
 *  genuinely sent it or someone recorded a manual transfer. */
function statusLabel(p: Payout): string {
  if (p.status === 'processed') return p.channel === 'manual' ? 'Paid out (manual)' : 'Paid out (RazorpayX)';
  if (p.status === 'pending') return 'Pending';
  if (p.status === 'processing') return 'Processing';
  if (p.status === 'reversed') return 'Reversed';
  return 'Failed';
}

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

type ManualTarget = { kind: 'payout'; id: number } | { kind: 'seller'; sellerId: number; amount: number };

/**
 * /admin/payouts — Fulfillment & Subscriptions redesign, Phase 5c. Every
 * payout row, computed automatically the moment an online order is paid
 * (see lib/payouts.ts's createPayoutsForOrder).
 *
 * Two genuinely different actions exist per pending/failed row, and they
 * are never merged into one ambiguous button: "Send via RazorpayX" (a
 * real transfer attempt — only does anything once a super admin has
 * enabled RazorpayX payouts in Settings) and "Mark as paid manually"
 * (Admin already paid her herself, outside the system, and is just
 * recording it — never calls RazorpayX). Both are isAdmin only; Customer
 * Support sees the same data with neither button.
 *
 * The "By seller" view exists specifically for the multi-seller-cart
 * case: one order can produce several payout rows (one per seller), and a
 * seller who shows up across several such orders can end up with several
 * pending rows scattered through the "By order" list — the batch actions
 * here clear every one of them for her in one click, whichever channel is
 * actually being used.
 */
export default function AdminPayoutsPage() {
  const { me } = useAdminPortal();
  const canSend = me.staffRole === 'admin' || me.staffRole === 'super_admin';

  const [view, setView] = useState<'orders' | 'sellers'>('orders');
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualTarget, setManualTarget] = useState<ManualTarget | null>(null);
  const [manualNote, setManualNote] = useState('');

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

  async function sendOne(id: number) {
    setBusyKey(`send-${id}`);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/payouts/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Could not send this payout.');
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function sendAllForSeller(sellerId: number) {
    setBusyKey(`send-seller-${sellerId}`);
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
      setBusyKey(null);
    }
  }

  function openManual(target: ManualTarget) {
    setManualTarget(target);
    setManualNote('');
    setError(null);
  }

  async function confirmManual() {
    if (!manualTarget) return;
    if (manualNote.trim().length < 5) {
      setError('Explain how you actually paid her (e.g. bank/UPI reference).');
      return;
    }
    const key = manualTarget.kind === 'payout' ? `manual-${manualTarget.id}` : `manual-seller-${manualTarget.sellerId}`;
    setBusyKey(key);
    setError(null);
    try {
      const url =
        manualTarget.kind === 'payout'
          ? `/api/admin/payouts/${manualTarget.id}/mark-paid`
          : `/api/admin/payouts/sellers/${manualTarget.sellerId}/mark-all-paid`;
      const res = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: manualNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not record this.');
        return;
      }
      if (manualTarget.kind === 'seller' && data.failed > 0) {
        setError(`${data.marked} recorded, ${data.failed} failed — check the order-by-order view for details.`);
      }
      setManualTarget(null);
      await load();
    } finally {
      setBusyKey(null);
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

      {manualTarget && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gold/30">
          <p className="font-body text-sm font-semibold text-ink">
            Mark {manualTarget.kind === 'seller' ? `₹${manualTarget.amount.toLocaleString('en-IN')} across all her pending orders` : 'this payout'} as paid manually
          </p>
          <p className="font-body text-xs text-ink-soft">
            This does not send any money — it only records that you already transferred it yourself. Required: how
            you paid (bank/UPI reference, date).
          </p>
          <input
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="e.g. NEFT, ref #123456, 3 Sept"
            className={inputStyles}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={confirmManual} disabled={busyKey !== null} className={buttonStyles('primary', 'sm')}>
              {busyKey ? 'Saving…' : 'Confirm — record as paid'}
            </button>
            <button onClick={() => setManualTarget(null)} className={buttonStyles('secondary', 'sm')}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
                <Link href={`/admin/sellers/${s.sellerId}`} className="flex items-center gap-3 hover:underline">
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
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  {s.pendingAmount > 0 && (
                    <span className="font-body text-sm font-semibold text-navy">
                      ₹{s.pendingAmount.toLocaleString('en-IN')} pending
                    </span>
                  )}
                  {canSend && s.pendingAmount > 0 && (
                    <>
                      <button
                        onClick={() => sendAllForSeller(s.sellerId)}
                        disabled={busyKey !== null}
                        className={buttonStyles('primary', 'sm')}
                        title="Attempt a real transfer via RazorpayX"
                      >
                        <Wallet2 className="h-3.5 w-3.5" strokeWidth={2} />
                        {busyKey === `send-seller-${s.sellerId}` ? 'Sending…' : 'Send via RazorpayX'}
                      </button>
                      <button
                        onClick={() => openManual({ kind: 'seller', sellerId: s.sellerId, amount: s.pendingAmount })}
                        disabled={busyKey !== null}
                        className={buttonStyles('secondary', 'sm')}
                        title="Record that you already paid her yourself"
                      >
                        <HandCoins className="h-3.5 w-3.5" strokeWidth={2} />
                        Mark as paid manually
                      </button>
                    </>
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
          <table className="w-full min-w-[820px] border-collapse font-body text-sm">
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
                const actionable = p.status === 'pending' || p.status === 'failed';
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
                        title={p.failureReason ?? p.manualNote ?? undefined}
                      >
                        <Icon className="h-3 w-3" strokeWidth={2} />
                        {statusLabel(p)}
                      </span>
                      {p.status === 'failed' && p.failureReason && (
                        <p className="mt-1 max-w-[220px] font-body text-[11px] text-red-600">{p.failureReason}</p>
                      )}
                      {p.status === 'processed' && p.channel === 'manual' && p.manualNote && (
                        <p className="mt-1 max-w-[220px] font-body text-[11px] text-ink-soft">{p.manualNote}</p>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {canSend && actionable && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => sendOne(p.id)}
                            disabled={busyKey !== null}
                            className={buttonStyles('secondary', 'sm')}
                            title="Attempt a real transfer via RazorpayX"
                          >
                            {busyKey === `send-${p.id}` ? 'Sending…' : p.status === 'failed' ? 'Retry RazorpayX' : 'Send via RazorpayX'}
                          </button>
                          <button
                            onClick={() => openManual({ kind: 'payout', id: p.id })}
                            disabled={busyKey !== null}
                            className={buttonStyles('secondary', 'sm')}
                            title="Record that you already paid her yourself"
                          >
                            Mark paid manually
                          </button>
                        </div>
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
