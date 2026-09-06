'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Mail, Phone, Tag, Plus } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type TicketStatus = 'open' | 'investigating' | 'resolved';
type Category = { id: number; key: string; name: string; active: boolean };
type Ticket = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  status: TicketStatus;
  categoryId: number | null;
  categoryName: string | null;
  assignedToStaffId: number | null;
  assignedToName: string | null;
  staffNote: string | null;
  createdAt: string;
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-red-50 text-red-600',
  investigating: 'bg-gold/15 text-gold-soft',
  resolved: 'bg-teal/10 text-teal-deep',
};

const FILTERS = [
  { key: 'active', label: 'Open & investigating' },
  { key: 'all', label: 'All' },
  { key: 'resolved', label: 'Resolved' },
] as const;

/**
 * /admin/support-tickets — every general complaint/question with no
 * order to attach it to (2026-09-06, marketplace-completeness scan) —
 * finally makes /contact real instead of a bare display email.
 */
export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('active');

  const load = useCallback(async () => {
    setTickets(null);
    const params = new URLSearchParams();
    if (filter === 'resolved') params.set('status', 'resolved');
    const res = await authFetch(`/api/admin/support-tickets?${params}`);
    const data = await res.json();
    let rows: Ticket[] = data.tickets ?? [];
    if (filter === 'active') rows = rows.filter((t) => t.status !== 'resolved');
    setTickets(rows);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function loadCategories() {
    authFetch('/api/admin/support-ticket-categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }
  useEffect(loadCategories, []);

  async function updateStatus(id: number, status: TicketStatus) {
    await authFetch(`/api/admin/support-tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Support Tickets</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Everything sent through /contact — questions and complaints with no order behind them.
        </p>
      </div>

      <CategoryManager categories={categories} onChanged={loadCategories} />

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

      {tickets === null ? (
        <RowListSkeleton count={4} />
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <MessageSquare className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No tickets match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tickets.map((t) => (
            <div key={t.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-body text-sm font-semibold text-ink">
                    {t.name}
                    {t.categoryName && (
                      <span className="ml-2 inline-flex rounded-full bg-navy/10 px-2 py-0.5 align-middle font-body text-[10px] font-semibold text-navy">
                        {t.categoryName}
                      </span>
                    )}
                  </p>
                  <p className="font-body text-xs text-ink-soft">
                    {t.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" strokeWidth={2} />
                        {t.email}
                      </span>
                    )}
                    {t.email && t.phone && ' · '}
                    {t.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" strokeWidth={2} />
                        {t.phone}
                      </span>
                    )}
                  </p>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => updateStatus(t.id, e.target.value as TicketStatus)}
                  className={`rounded-full border-0 px-2.5 py-1 font-body text-xs font-semibold ${STATUS_CLASS[t.status]}`}
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <p className="font-body text-sm text-ink-soft">{t.message}</p>
              <p className="font-body text-[11px] text-ink-soft/70">
                {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryManager({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCategory() {
    if (!key.trim() || !name.trim()) {
      setError('Both a key and a name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/support-ticket-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.key?.[0] ?? data.error ?? 'Could not add this category.');
        return;
      }
      setKey('');
      setName('');
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cat: Category) {
    await authFetch(`/api/admin/support-ticket-categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !cat.active }),
    });
    onChanged();
  }

  return (
    <div className="rounded-2xl bg-ivory-deep/60 p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 font-body text-sm font-semibold text-ink">
        <Tag className="h-4 w-4 text-navy" strokeWidth={2} />
        Categories ({categories.length})
        <span className="font-body text-xs font-normal text-ink-soft">{open ? '— hide' : '— manage'}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleActive(c)}
                title={c.active ? 'Click to archive' : 'Click to restore'}
                className={`rounded-full px-3 py-1 font-body text-xs font-medium transition ${
                  c.active ? 'bg-teal/10 text-teal-deep' : 'bg-ink-soft/10 text-ink-soft line-through'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="key, e.g. seller_complaint"
              className={`${inputStyles} w-52`}
            />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" className={`${inputStyles} w-52`} />
            <button onClick={addCategory} disabled={saving} className={buttonStyles('secondary', 'sm')}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              {saving ? 'Adding…' : 'Add category'}
            </button>
          </div>
          {error && <p className="font-body text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
