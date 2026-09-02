'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Building2, Plus, Trash2, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Office = {
  id: number;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  contactPhone: string | null;
  active: boolean;
};

export default function AdminWebohraOfficesPage() {
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    const res = await authFetch('/api/admin/webohra-offices');
    const data = await res.json();
    setOffices(data.offices ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(office: Office) {
    await authFetch(`/api/admin/webohra-offices/${office.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !office.active }),
    });
    load();
  }

  async function remove(office: Office) {
    if (!confirm(`Delete "${office.name}"? Any jamaat mapped to it loses that mapping.`)) return;
    await authFetch(`/api/admin/webohra-offices/${office.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">WeBohra Offices</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Volunteer-staffed drop-off/pickup locations — map jamaats to one from the Jamaats page.
          </p>
        </div>
        <button onClick={() => setFormOpen(true)} className={buttonStyles('accent', 'sm')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add office
        </button>
      </div>

      {offices === null ? (
        <RowListSkeleton count={3} />
      ) : offices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Building2 className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No offices yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {offices.map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <Building2 className="h-4.5 w-4.5 shrink-0 text-navy" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-ink">{o.name}</p>
                <p className="truncate font-body text-xs text-ink-soft">
                  {o.addressLine1}
                  {o.addressLine2 ? `, ${o.addressLine2}` : ''}, {o.city}, {o.state} {o.pincode}
                </p>
                {o.contactPhone && <p className="font-body text-xs text-ink-soft">{o.contactPhone}</p>}
              </div>
              {!o.active && (
                <span className="rounded-full bg-ink-soft/10 px-2 py-0.5 font-body text-[11px] text-ink-soft">Inactive</span>
              )}
              <button onClick={() => toggleActive(o)} className={buttonStyles('secondary', 'sm')}>
                {o.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => remove(o)}
                aria-label={`Delete ${o.name}`}
                title="Delete office"
                className={buttonStyles('ghost', 'sm', 'text-red-600 hover:text-red-700')}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <OfficeFormModal
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

function OfficeFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/webohra-offices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          city,
          state,
          pincode,
          contactPhone: contactPhone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstIssue = data.issues ? Object.values(data.issues)[0] : null;
        setError((Array.isArray(firstIssue) ? firstIssue[0] : firstIssue) ?? data.error ?? 'Could not save.');
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
          <h2 className="font-heading text-lg font-semibold text-ink">New office</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office name" required autoFocus className={inputStyles} />
        <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Address line 1" required className={inputStyles} />
        <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Address line 2 (optional)" className={inputStyles} />
        <div className="grid grid-cols-2 gap-2.5">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" required className={inputStyles} />
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" required className={inputStyles} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Pincode" required className={inputStyles} />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone (optional)" className={inputStyles} />
        </div>
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Create office'}
        </button>
      </form>
    </div>
  );
}
