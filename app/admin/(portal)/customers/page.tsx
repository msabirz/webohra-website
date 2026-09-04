'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, User, CheckCircle2 } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Customer = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string;
  phoneVerified: boolean;
  createdAt: string;
  orderCount: number;
};

/**
 * /admin/customers — the buyer-facing equivalent of /admin/sellers
 * (2026-09-04, user's own ask — this didn't exist before). Search only,
 * no verification workflow to gate (unlike sellers' ITS review) since a
 * buyer account has nothing to approve.
 */
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    setCustomers(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const res = await authFetch(`/api/admin/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Customers</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Every registered buyer account. A guest checkout&apos;s order is still visible on Orders
          by her name/phone — she just doesn&apos;t have an account to browse here.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="relative w-full sm:w-80"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone…"
          className={`${inputStyles} w-full pl-9`}
        />
      </form>

      {customers === null ? (
        <RowListSkeleton count={4} />
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <User className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No customers match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customers/${c.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:ring-navy/20"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
                <User className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-ink">
                  {c.name ?? c.email ?? c.phone}
                </p>
                <p className="truncate font-body text-xs text-ink-soft">
                  {c.email && `${c.email} · `}
                  {c.phone}
                  {c.phoneVerified && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-teal-deep">
                      <CheckCircle2 className="inline h-3 w-3" strokeWidth={2.5} /> verified
                    </span>
                  )}
                </p>
              </div>
              <p className="shrink-0 font-body text-xs font-medium text-ink-soft">
                {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
