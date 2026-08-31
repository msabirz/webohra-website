'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, Store, Package } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { Skeleton, RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type SellerDetail = {
  userId: number;
  name: string | null;
  email: string | null;
  phone: string;
  itsId: string | null;
  itsVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  businessName: string;
  jamaatCity: string | null;
  jamaatName: string | null;
};

type SellerListing = {
  id: number;
  title: string;
  price: string;
  status: string;
  subcategoryName: string;
  createdAt: string;
};

export default function AdminSellerDetailPage() {
  const params = useParams<{ id: string }>();
  const { me } = useAdminPortal();
  const canVerify = me.staffRole !== 'customer_support';

  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function load() {
    const res = await authFetch(`/api/admin/sellers/${params.id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setSeller(data.seller);
    setListings(data.listings ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function toggleVerify() {
    if (!seller) return;
    setBusy(true);
    try {
      await authFetch(`/api/admin/sellers/${seller.userId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itsVerified: !seller.itsVerified }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return <p className="font-body text-sm text-ink-soft">Seller not found.</p>;
  }

  if (!seller) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <RowListSkeleton count={2} withIcon={false} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/5">
            <Store className="h-5 w-5 text-navy" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold text-ink">{seller.businessName}</h1>
            <p className="font-body text-sm text-ink-soft">{seller.name ?? seller.email ?? seller.phone}</p>
          </div>
        </div>
        {seller.itsVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-3 py-1.5 font-body text-xs font-semibold text-teal-deep">
            <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-3 py-1.5 font-body text-xs font-semibold text-ink">
            <ShieldAlert className="h-4 w-4" strokeWidth={2} />
            Pending
          </span>
        )}
      </div>

      <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5 sm:grid-cols-2">
        <Field label="ITS ID" value={seller.itsId ?? '—'} />
        <Field label="Phone" value={`${seller.phone}${seller.phoneVerified ? ' (verified)' : ''}`} />
        <Field label="Email" value={seller.email ?? '—'} />
        <Field label="Jamaat" value={seller.jamaatName ? `${seller.jamaatName} — ${seller.jamaatCity}` : 'Not set (self-managed shipping only)'} />
        <Field label="Registered" value={new Date(seller.createdAt).toLocaleDateString('en-IN')} />
        <Field label="Products" value={String(listings.length)} />
      </div>

      {canVerify && (
        <button onClick={toggleVerify} disabled={busy} className={buttonStyles('primary', 'md', 'w-fit')}>
          {busy ? 'Saving…' : seller.itsVerified ? 'Revoke ITS verification' : 'Approve ITS verification'}
        </button>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-semibold text-ink">Products</h2>
        {listings.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
            No products yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/admin/products?q=${encodeURIComponent(l.title)}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-ink-soft/5 hover:shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-ink-soft/50" strokeWidth={1.75} />
                  <div>
                    <p className="font-body text-sm text-ink">{l.title}</p>
                    <p className="font-body text-xs text-ink-soft">{l.subcategoryName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm font-medium text-navy">
                    ₹{Number(l.price).toLocaleString('en-IN')}
                  </span>
                  <span className="rounded-full bg-ink-soft/10 px-2.5 py-1 font-body text-xs text-ink-soft">
                    {l.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-body text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 font-body text-sm text-ink">{value}</p>
    </div>
  );
}
