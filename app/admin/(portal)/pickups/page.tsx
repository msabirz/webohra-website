'use client';

import { useEffect, useState } from 'react';
import { Truck, CheckCircle2, AlertOctagon, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Pickup = {
  id: number;
  buyerName: string;
  buyerPhone: string;
  requestedDate: string;
  requestedPlace: string;
  status: 'pending' | 'received' | 'issue';
  notes: string | null;
  handledAt: string | null;
  createdAt: string;
  listingTitle: string;
  businessName: string | null;
  jamaatCity: string | null;
  jamaatName: string | null;
};

const STATUS_LABEL: Record<Pickup['status'], string> = {
  pending: 'Pending',
  received: 'Received',
  issue: 'Issue',
};
const STATUS_CLASS: Record<Pickup['status'], string> = {
  pending: 'bg-gold/20 text-ink',
  received: 'bg-teal/10 text-teal-deep',
  issue: 'bg-red-100 text-red-700',
};

export default function AdminPickupsPage() {
  const [pickups, setPickups] = useState<Pickup[] | null>(null);
  const [status, setStatus] = useState<'all' | Pickup['status']>('pending');
  const [acting, setActing] = useState<Pickup | null>(null);

  async function load() {
    setPickups(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    const res = await authFetch(`/api/admin/pickups?${params}`);
    const data = await res.json();
    setPickups(data.pickups ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Pickups</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          FR-47: Customer Support receives and logs parcels dropped off at each jamaat for
          Delhivery-managed sellers.
        </p>
      </div>

      <div className="flex gap-1.5 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'received', label: 'Received' },
          { key: 'issue', label: 'Issues' },
          { key: 'all', label: 'All' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key as typeof status)}
            className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
              status === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pickups === null ? (
        <RowListSkeleton count={4} withIcon={false} />
      ) : pickups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Truck className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">Nothing here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pickups.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-semibold text-ink">{p.listingTitle}</p>
                <p className="font-body text-xs text-ink-soft">
                  {p.businessName ?? 'Unknown seller'} · {p.jamaatName ? `${p.jamaatName}, ${p.jamaatCity}` : 'No jamaat set'}
                </p>
                <p className="font-body text-xs text-ink-soft">
                  Buyer: {p.buyerName} ({p.buyerPhone}) · Requested {p.requestedDate} at {p.requestedPlace}
                </p>
                {p.notes && <p className="mt-0.5 font-body text-xs italic text-ink-soft">&ldquo;{p.notes}&rdquo;</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${STATUS_CLASS[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                {p.status === 'pending' && (
                  <button onClick={() => setActing(p)} className={buttonStyles('secondary', 'sm')}>
                    Log outcome
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {acting && <PickupActionModal pickup={acting} onClose={() => setActing(null)} onDone={load} />}
    </div>
  );
}

function PickupActionModal({
  pickup,
  onClose,
  onDone,
}: {
  pickup: Pickup;
  onClose: () => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<'received' | 'issue'>('received');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await authFetch(`/api/admin/pickups/${pickup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: outcome, notes }),
      });
      onDone();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Log outcome</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOutcome('received')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-body text-sm font-medium transition ${
              outcome === 'received' ? 'border-teal bg-teal/10 text-teal-deep' : 'border-ink-soft/20 text-ink-soft'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
            Received
          </button>
          <button
            type="button"
            onClick={() => setOutcome('issue')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-body text-sm font-medium transition ${
              outcome === 'issue' ? 'border-red-400 bg-red-50 text-red-700' : 'border-ink-soft/20 text-ink-soft'
            }`}
          >
            <AlertOctagon className="h-4 w-4" strokeWidth={2} />
            Issue
          </button>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes (optional)"
          className={`${inputStyles} resize-none`}
        />

        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
