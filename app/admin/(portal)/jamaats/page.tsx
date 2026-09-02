'use client';

import { useEffect, useState, FormEvent } from 'react';
import { MapPin, Plus, Trash2, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Jamaat = { id: number; city: string; name: string; active: boolean; officeId: number | null };
type Office = { id: number; name: string; city: string; active: boolean };

export default function AdminJamaatsPage() {
  const [jamaats, setJamaats] = useState<Jamaat[] | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    const [jamaatsRes, officesRes] = await Promise.all([
      authFetch('/api/admin/jamaats'),
      authFetch('/api/admin/webohra-offices'),
    ]);
    const jamaatsData = await jamaatsRes.json();
    const officesData = await officesRes.json();
    setJamaats(jamaatsData.jamaats ?? []);
    setOffices(officesData.offices ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(jamaat: Jamaat) {
    await authFetch(`/api/admin/jamaats/${jamaat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !jamaat.active }),
    });
    load();
  }

  async function setOffice(jamaat: Jamaat, officeId: string) {
    await authFetch(`/api/admin/jamaats/${jamaat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeId: officeId ? Number(officeId) : null }),
    });
    load();
  }

  async function remove(jamaat: Jamaat) {
    if (!confirm(`Delete "${jamaat.name}, ${jamaat.city}"? Sellers using it fall back to self-managed shipping.`)) return;
    await authFetch(`/api/admin/jamaats/${jamaat.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Jamaats</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            The fixed pickup-point list Delhivery-managed sellers choose from (FR-46/47).
          </p>
        </div>
        <button onClick={() => setFormOpen(true)} className={buttonStyles('accent', 'sm')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add jamaat
        </button>
      </div>

      {jamaats === null ? (
        <RowListSkeleton count={4} />
      ) : jamaats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <MapPin className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No jamaats yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {jamaats.map((j) => (
            <div key={j.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <MapPin className="h-4.5 w-4.5 shrink-0 text-navy" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-ink">{j.name}</p>
                <p className="truncate font-body text-xs text-ink-soft">{j.city}</p>
              </div>
              <select
                value={j.officeId ?? ''}
                onChange={(e) => setOffice(j, e.target.value)}
                className={inputStyles + ' !w-auto max-w-[180px] !py-1.5 text-xs'}
                aria-label={`WeBohra office for ${j.name}`}
              >
                <option value="">No office mapped</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.city})
                  </option>
                ))}
              </select>
              {!j.active && (
                <span className="rounded-full bg-ink-soft/10 px-2 py-0.5 font-body text-[11px] text-ink-soft">Inactive</span>
              )}
              <button onClick={() => toggleActive(j)} className={buttonStyles('secondary', 'sm')}>
                {j.active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => remove(j)} className={buttonStyles('ghost', 'sm', 'text-red-600 hover:text-red-700')}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <JamaatFormModal
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

function JamaatFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [city, setCity] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/jamaats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.city?.[0] ?? data.issues?.name?.[0] ?? data.error ?? 'Could not save.');
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
          <h2 className="font-heading text-lg font-semibold text-ink">New jamaat</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamaat name" required autoFocus className={inputStyles} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" required className={inputStyles} />
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Create jamaat'}
        </button>
      </form>
    </div>
  );
}
