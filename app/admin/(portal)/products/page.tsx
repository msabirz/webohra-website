'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Package, Flag, Trash2, RotateCcw, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { inputStyles, buttonStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Status = 'draft' | 'active' | 'archived' | 'flagged' | 'removed';

type AdminListing = {
  id: number;
  slug: string;
  title: string;
  // null = different types, no single price of its own.
  price: string | null;
  status: Status;
  moderationNote: string | null;
  stockQuantity: number | null;
  categoryName: string;
  subcategoryName: string;
  businessName: string | null;
  sellerItsVerified: boolean;
  coverImageUrl: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
  flagged: 'Flagged',
  removed: 'Removed',
};
const STATUS_CLASS: Record<Status, string> = {
  draft: 'bg-ink-soft/10 text-ink-soft',
  active: 'bg-teal/10 text-teal-deep',
  archived: 'bg-ink-soft/10 text-ink-soft',
  flagged: 'bg-gold/20 text-ink',
  removed: 'bg-red-100 text-red-700',
};

const TABS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Published' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'removed', label: 'Removed' },
  { key: 'draft', label: 'Draft' },
  { key: 'archived', label: 'Archived' },
];

export default function AdminProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [tab, setTab] = useState<Status | 'all'>('all');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [moderating, setModerating] = useState<AdminListing | null>(null);

  async function load() {
    setListings(null);
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    if (q) params.set('q', q);
    const res = await authFetch(`/api/admin/listings?${params}`);
    const data = await res.json();
    setListings(data.listings ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Products</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Every product across every seller — moderate, flag, remove, or restore (FR-14).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                tab === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title…"
            className={`${inputStyles} w-64 pl-9`}
          />
        </form>
      </div>

      {listings === null ? (
        <RowListSkeleton count={5} />
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Package className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No products match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ivory-deep">
                  {l.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
                    <img src={l.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-4 w-4 text-ink-soft/40" strokeWidth={1.5} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-ink">{l.title}</p>
                  <p className="truncate font-body text-xs text-ink-soft">
                    {l.businessName ?? 'Unknown seller'} · {l.categoryName} ·{' '}
                    {l.price !== null ? `₹${Number(l.price).toLocaleString('en-IN')}` : 'Multiple types'}
                    {!l.sellerItsVerified && ' · seller unverified'}
                  </p>
                  {l.moderationNote && (
                    <p className="mt-0.5 font-body text-xs italic text-red-600">&ldquo;{l.moderationNote}&rdquo;</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${STATUS_CLASS[l.status]}`}>
                  {STATUS_LABEL[l.status]}
                </span>
                {(l.status === 'active' || l.status === 'draft' || l.status === 'archived') && (
                  <button onClick={() => setModerating(l)} className={buttonStyles('secondary', 'sm')}>
                    <Flag className="h-3.5 w-3.5" strokeWidth={2} />
                    Flag / Remove
                  </button>
                )}
                {(l.status === 'flagged' || l.status === 'removed') && (
                  <button
                    onClick={async () => {
                      await authFetch(`/api/admin/listings/${l.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'draft' }),
                      });
                      load();
                    }}
                    className={buttonStyles('secondary', 'sm')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {moderating && (
        <ModerationModal listing={moderating} onClose={() => setModerating(null)} onDone={load} />
      )}
    </div>
  );
}

function ModerationModal({
  listing,
  onClose,
  onDone,
}: {
  listing: AdminListing;
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<'flagged' | 'removed'>('flagged');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, moderationNote: note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.moderationNote?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
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
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
              <Flag className="h-4.5 w-4.5 text-red-600" strokeWidth={2} />
            </span>
            <h2 className="font-heading text-lg font-semibold text-ink">Moderate &ldquo;{listing.title}&rdquo;</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAction('flagged')}
            className={`flex-1 rounded-xl border px-3 py-2 font-body text-sm font-medium transition ${
              action === 'flagged' ? 'border-gold bg-gold-soft/20 text-ink' : 'border-ink-soft/20 text-ink-soft'
            }`}
          >
            Flag (keep visible, warn)
          </button>
          <button
            type="button"
            onClick={() => setAction('removed')}
            className={`flex-1 rounded-xl border px-3 py-2 font-body text-sm font-medium transition ${
              action === 'removed' ? 'border-red-400 bg-red-50 text-red-700' : 'border-ink-soft/20 text-ink-soft'
            }`}
          >
            <Trash2 className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
            Remove (take down)
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Reason (shown to the seller)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            required
            placeholder="e.g. Product photos don't match the description"
            className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5 font-body text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>

        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : `Confirm ${action === 'flagged' ? 'flag' : 'removal'}`}
        </button>
      </form>
    </div>
  );
}
