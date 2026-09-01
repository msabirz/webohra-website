'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, AlertTriangle, Clock, Eraser } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Enquiry = {
  id: number;
  requestNumber: string;
  status: 'initiated' | 'viewed' | 'accepted' | 'rejected' | 'completed' | 'auto_closed_no_update';
  createdAt: string;
  listingTitle: string;
  variantName: string | null;
  businessName: string | null;
  buyerName: string | null;
  buyerPhone: string;
  slow: boolean;
  needsReminder: boolean;
};

const STATUS_LABEL: Record<Enquiry['status'], string> = {
  initiated: 'Initiated',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
  auto_closed_no_update: 'Auto-closed (no update)',
};
const STATUS_CLASS: Record<Enquiry['status'], string> = {
  initiated: 'bg-gold/20 text-ink',
  viewed: 'bg-navy/10 text-navy',
  accepted: 'bg-teal/10 text-teal-deep',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-teal/10 text-teal-deep',
  auto_closed_no_update: 'bg-ink-soft/10 text-ink-soft',
};

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [status, setStatus] = useState<'all' | Enquiry['status']>('all');
  const [sweeping, setSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState<string | null>(null);

  async function load() {
    setEnquiries(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    const res = await authFetch(`/api/admin/enquiries?${params}`);
    const data = await res.json();
    setEnquiries(data.enquiries ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function runSweep() {
    setSweeping(true);
    setSweepMessage(null);
    try {
      const res = await authFetch('/api/admin/enquiries/sweep', { method: 'POST' });
      const data = await res.json();
      setSweepMessage(
        data.closedCount > 0
          ? `Auto-closed ${data.closedCount} enquir${data.closedCount === 1 ? 'y' : 'ies'} with no update in 30 days.`
          : 'Nothing to close — no enquiry has gone 30 days without an update.',
      );
      load();
    } finally {
      setSweeping(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Enquiries</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Every Take Consultation / Contact Seller request (FR-21–27).
          </p>
        </div>
        <button onClick={runSweep} disabled={sweeping} className={buttonStyles('secondary', 'sm')}>
          <Eraser className="h-3.5 w-3.5" strokeWidth={2} />
          {sweeping ? 'Running…' : 'Run 30-day sweep'}
        </button>
      </div>

      {sweepMessage && (
        <p className="rounded-xl bg-navy/5 px-4 py-2.5 font-body text-sm text-ink">{sweepMessage}</p>
      )}

      <div className="flex gap-1.5 overflow-x-auto rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
        {[
          { key: 'all', label: 'All' },
          { key: 'initiated', label: 'Initiated' },
          { key: 'viewed', label: 'Viewed' },
          { key: 'accepted', label: 'Accepted' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'completed', label: 'Completed' },
          { key: 'auto_closed_no_update', label: 'Auto-closed' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key as typeof status)}
            className={`shrink-0 rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
              status === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {enquiries === null ? (
        <RowListSkeleton count={4} withIcon={false} />
      ) : enquiries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <MessageSquare className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No enquiries match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {enquiries.map((e) => (
            <div key={e.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-semibold text-ink">
                  {e.listingTitle}
                  {e.variantName && ` — ${e.variantName}`}{' '}
                  <span className="font-normal text-ink-soft">· #{e.requestNumber}</span>
                </p>
                <p className="font-body text-xs text-ink-soft">
                  {e.buyerName ?? e.buyerPhone} → {e.businessName ?? 'Unknown seller'} ·{' '}
                  {new Date(e.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {e.slow && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-body text-xs font-semibold text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                    24h+ no response
                  </span>
                )}
                {e.needsReminder && !e.slow && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 font-body text-xs font-semibold text-ink">
                    <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                    Reminder due
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${STATUS_CLASS[e.status]}`}>
                  {STATUS_LABEL[e.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
