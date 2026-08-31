'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Banner = {
  id: number;
  heading: string;
  subheading: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  colorHex: string;
  sortOrder: number;
  active: boolean;
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    const res = await authFetch('/api/admin/banners');
    const data = await res.json();
    setBanners(data.banners ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(banner: Banner) {
    await authFetch(`/api/admin/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !banner.active }),
    });
    load();
  }

  async function remove(banner: Banner) {
    if (!confirm(`Delete "${banner.heading}"?`)) return;
    await authFetch(`/api/admin/banners/${banner.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Banners</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">The homepage hero slider — Admin-managed, not seller-managed.</p>
        </div>
        <button onClick={() => setFormOpen(true)} className={buttonStyles('accent', 'sm')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add banner
        </button>
      </div>

      {banners === null ? (
        <RowListSkeleton count={2} />
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <ImageIcon className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No banners yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <span className="h-12 w-20 shrink-0 rounded-lg" style={{ backgroundColor: b.colorHex }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-ink">{b.heading}</p>
                <p className="truncate font-body text-xs text-ink-soft">{b.subheading}</p>
              </div>
              <button onClick={() => toggleActive(b)} className={buttonStyles('secondary', 'sm')}>
                {b.active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => remove(b)} className={buttonStyles('ghost', 'sm', 'text-red-600 hover:text-red-700')}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <BannerFormModal
          onClose={() => setFormOpen(false)}
          onDone={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function BannerFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [heading, setHeading] = useState('');
  const [subheading, setSubheading] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [colorHex, setColorHex] = useState('#1B3A6B');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading, subheading, ctaLabel, ctaHref, colorHex, sortOrder: 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.heading?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">New banner</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Heading" required autoFocus className={inputStyles} />
        <input value={subheading} onChange={(e) => setSubheading(e.target.value)} placeholder="Subheading (optional)" className={inputStyles} />
        <div className="flex gap-2">
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Button label" className={inputStyles} />
          <input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/search" className={inputStyles} />
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="h-10 w-14 rounded-lg border border-ink-soft/20" />
          <input value={colorHex} onChange={(e) => setColorHex(e.target.value)} className={`${inputStyles} flex-1`} />
        </div>
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Create banner'}
        </button>
      </form>
    </div>
  );
}
