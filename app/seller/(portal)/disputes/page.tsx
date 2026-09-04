'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Search } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { RowListSkeleton } from '@/components/skeleton';

type Dispute = {
  id: number;
  orderNumber: string;
  status: 'open' | 'investigating' | 'resolved';
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
};

const STATUS_STYLE: Record<Dispute['status'], { label: string; cls: string; icon: typeof AlertTriangle }> = {
  open: { label: 'Open', cls: 'bg-red-50 text-red-700 ring-red-600/10', icon: AlertTriangle },
  investigating: { label: 'Investigating', cls: 'bg-gold/15 text-ink ring-gold/30', icon: Search },
  resolved: { label: 'Resolved', cls: 'bg-teal/10 text-teal-deep ring-teal/20', icon: ShieldCheck },
};

/**
 * /seller/disputes — real visibility into any dispute on an order she has
 * items in (2026-09-04, user's own ask, following an audit that found she
 * previously had none at all — see /api/sellers/disputes' own comment).
 * Read-only, and just the dispute's own reason/status, not Admin's
 * internal comment timeline — she can see WHAT is being disputed and
 * WHY, and follow through to the order itself for the transaction
 * detail, but not staff-to-staff notes never meant for her.
 */
export default function SellerDisputesPage() {
  const [disputesList, setDisputesList] = useState<Dispute[] | null>(null);

  useEffect(() => {
    authFetch('/api/sellers/disputes')
      .then((res) => res.json())
      .then((data) => setDisputesList(data.disputes ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Disputes</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Any issue flagged on one of your orders — including an amount WE Bohra needs to recover
          from you if a refund landed after you&apos;d already been paid out for it.
        </p>
      </div>

      {disputesList === null ? (
        <RowListSkeleton count={3} />
      ) : disputesList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <ShieldCheck className="h-8 w-8 text-teal/50" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No disputes on your orders — all clear.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {disputesList.map((d) => {
            const { label, cls, icon: Icon } = STATUS_STYLE[d.status];
            return (
              <div key={d.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold ring-1 ${cls}`}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    {label}
                  </span>
                  <p className="font-body text-xs text-ink-soft">
                    {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <p className="font-body text-sm text-ink">{d.reason}</p>
                <p className="font-body text-xs font-semibold text-ink-soft">
                  Order <span className="text-ink">{d.orderNumber}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
