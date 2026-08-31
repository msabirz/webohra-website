'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ShieldCheck, ShieldAlert, Store } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { inputStyles, buttonStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type Seller = {
  userId: number;
  name: string | null;
  email: string | null;
  phone: string;
  itsId: string | null;
  itsVerified: boolean;
  createdAt: string;
  businessName: string;
  jamaatCity: string | null;
  jamaatName: string | null;
  listingCount: number;
};

export default function AdminSellersPage() {
  return (
    <Suspense fallback={null}>
      <SellersView />
    </Suspense>
  );
}

function SellersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me } = useAdminPortal();
  const canVerify = me.staffRole !== 'customer_support';

  const [sellers, setSellers] = useState<Seller[] | null>(null);
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const verified = searchParams.get('verified') ?? 'all';
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setSellers(null);
    const params = new URLSearchParams();
    if (verified !== 'all') params.set('verified', verified);
    if (q) params.set('q', q);
    const res = await authFetch(`/api/admin/sellers?${params}`);
    const data = await res.json();
    setSellers(data.sellers ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  function setFilter(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('verified');
    else params.set('verified', next);
    router.push(`/admin/sellers?${params}`);
  }

  async function toggleVerify(userId: number, itsVerified: boolean) {
    setBusyId(userId);
    try {
      await authFetch(`/api/admin/sellers/${userId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itsVerified }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Sellers</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          ITS verification queue and every registered seller (FR-13).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'verified', label: 'Verified' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                verified === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
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
            placeholder="Search business, name, email, phone…"
            className={`${inputStyles} w-72 pl-9`}
          />
        </form>
      </div>

      {sellers === null ? (
        <RowListSkeleton count={4} />
      ) : sellers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Store className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No sellers match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sellers.map((seller) => (
            <div
              key={seller.userId}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link href={`/admin/sellers/${seller.userId}`} className="flex flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
                  <Store className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-ink">{seller.businessName}</p>
                  <p className="truncate font-body text-xs text-ink-soft">
                    {seller.name ?? seller.email ?? seller.phone} · ITS {seller.itsId ?? '—'} ·{' '}
                    {seller.listingCount} product{seller.listingCount === 1 ? '' : 's'}
                    {seller.jamaatCity && ` · ${seller.jamaatCity}`}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {seller.itsVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 font-body text-xs font-semibold text-teal-deep">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 font-body text-xs font-semibold text-ink">
                    <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                    Pending
                  </span>
                )}
                {canVerify && (
                  <button
                    disabled={busyId === seller.userId}
                    onClick={() => toggleVerify(seller.userId, !seller.itsVerified)}
                    className={buttonStyles('secondary', 'sm')}
                  >
                    {seller.itsVerified ? 'Un-verify' : 'Verify'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
