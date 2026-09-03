'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, AlertTriangle, RefreshCw, CheckCircle2, User } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type DisputeStatus = 'open' | 'investigating' | 'resolved';
type Dispute = {
  id: number;
  orderId: number;
  orderNumber: string;
  buyerName: string;
  status: DisputeStatus;
  reason: string;
  assignedToStaffId: number | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<DisputeStatus, string> = { open: 'Open', investigating: 'Investigating', resolved: 'Resolved' };
const STATUS_CLASS: Record<DisputeStatus, string> = {
  open: 'bg-red-50 text-red-600',
  investigating: 'bg-gold/15 text-gold-soft',
  resolved: 'bg-teal/10 text-teal-deep',
};
const STATUS_ICON: Record<DisputeStatus, typeof AlertTriangle> = {
  open: AlertTriangle,
  investigating: RefreshCw,
  resolved: CheckCircle2,
};

const FILTERS = [
  { key: 'active', label: 'Open & investigating' },
  { key: 'all', label: 'All' },
  { key: 'resolved', label: 'Resolved' },
] as const;

/**
 * /admin/disputes — every dispute across every order in one place, so
 * nothing needing follow-up depends on someone remembering to check each
 * order individually. Admin Panel transaction/dispute/refund tooling,
 * 2026-09-03. Working a specific dispute (status, assignment, notes)
 * happens inline on the order's own detail page (linked from here) — this
 * page is deliberately just the triage list.
 */
export default function AdminDisputesPage() {
  const { me } = useAdminPortal();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('active');
  const [mineOnly, setMineOnly] = useState(false);

  const load = useCallback(async () => {
    setDisputes(null);
    const params = new URLSearchParams();
    if (filter === 'resolved') params.set('status', 'resolved');
    if (mineOnly) params.set('assignedToMe', '1');
    const res = await authFetch(`/api/admin/disputes?${params}`);
    const data = await res.json();
    let rows: Dispute[] = data.disputes ?? [];
    if (filter === 'active') rows = rows.filter((d) => d.status !== 'resolved');
    setDisputes(rows);
  }, [filter, mineOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Disputes</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">Every issue flagged against an order, tracked to resolution.</p>
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
        <button
          onClick={() => setMineOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
            mineOnly ? 'bg-navy text-ivory' : 'bg-white text-ink-soft shadow-sm ring-1 ring-ink-soft/5 hover:text-ink'
          }`}
        >
          <User className="h-3.5 w-3.5" strokeWidth={2} />
          Assigned to me
        </button>
      </div>

      {disputes === null ? (
        <RowListSkeleton count={4} />
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Flag className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No disputes match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {disputes.map((d) => {
            const Icon = STATUS_ICON[d.status];
            return (
              <Link
                key={d.id}
                href={`/admin/orders/${d.orderNumber}`}
                className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:ring-navy/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-body text-sm font-semibold text-ink">
                    {d.orderNumber} <span className="font-normal text-ink-soft">— {d.buyerName}</span>
                  </p>
                  <p className="truncate font-body text-xs text-ink-soft">{d.reason}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="font-body text-xs text-ink-soft">
                    {d.assignedToName ?? d.assignedToEmail ?? 'Unassigned'}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold ${STATUS_CLASS[d.status]}`}>
                    <Icon className="h-3 w-3" strokeWidth={2} />
                    {STATUS_LABEL[d.status]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {me.staffRole === 'customer_support' && (
        <p className="font-body text-xs text-ink-soft">Refunds are Admin/Super Admin only — open a dispute here and it stays trackable for whoever can act on it.</p>
      )}
    </div>
  );
}
