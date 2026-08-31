'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Users, Plus, X, ShieldOff } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type StaffRole = 'customer_support' | 'admin' | 'super_admin';
type StaffMember = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string;
  staffRole: StaffRole;
  createdAt: string;
};

const ROLE_LABEL: Record<StaffRole, string> = {
  customer_support: 'Customer Support',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export default function AdminStaffPage() {
  const { me } = useAdminPortal();

  if (me.staffRole !== 'super_admin') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
        <ShieldOff className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
        <p className="font-body text-sm text-ink-soft">Only Super Admins can manage staff access.</p>
      </div>
    );
  }

  return <StaffView currentUserId={me.id} />;
}

function StaffView({ currentUserId }: { currentUserId: number }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await authFetch('/api/admin/staff');
    const data = await res.json();
    setStaff(data.staff ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(member: StaffMember, role: StaffRole | null) {
    setError(null);
    const res = await authFetch(`/api/admin/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not update.');
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Staff</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Grant or revoke Admin Panel access. Super Admin only.
          </p>
        </div>
        <button onClick={() => setFormOpen(true)} className={buttonStyles('accent', 'sm')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add staff
        </button>
      </div>

      {error && <p className="font-body text-sm text-red-700">{error}</p>}

      {staff === null ? (
        <RowListSkeleton count={3} withIcon={false} />
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Users className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No staff yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {staff.map((member) => (
            <div key={member.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-semibold text-ink">
                  {member.name ?? member.email ?? member.phone}
                  {member.id === currentUserId && <span className="ml-2 font-body text-xs text-ink-soft">(you)</span>}
                </p>
                <p className="font-body text-xs text-ink-soft">{member.email ?? member.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={member.staffRole}
                  onChange={(e) => changeRole(member, e.target.value as StaffRole)}
                  className={inputStyles}
                >
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (confirm(`Revoke staff access for ${member.name ?? member.email ?? member.phone}?`)) {
                      changeRole(member, null);
                    }
                  }}
                  className={buttonStyles('ghost', 'sm', 'text-red-600 hover:text-red-700')}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <AddStaffModal
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

function AddStaffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('customer_support');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save.');
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
          <h2 className="font-heading text-lg font-semibold text-ink">Add staff</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <p className="font-body text-xs text-ink-soft">
          Grants access to an existing WE Bohra account — she needs to have signed up already (as a
          buyer or seller), since there&apos;s no email invite yet.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Her email address"
          required
          autoFocus
          className={inputStyles}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputStyles}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Grant access'}
        </button>
      </form>
    </div>
  );
}
