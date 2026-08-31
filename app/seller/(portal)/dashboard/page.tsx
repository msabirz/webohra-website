'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, PlusCircle, ShieldAlert, ArrowRight } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { useSellerPortal } from '@/lib/seller-context';
import { Skeleton } from '@/components/skeleton';

type MyListing = { id: number; status: 'draft' | 'active' | 'archived' | 'flagged' | 'removed' };

export default function SellerDashboardPage() {
  const { me } = useSellerPortal();
  const [listings, setListings] = useState<MyListing[] | null>(null);

  useEffect(() => {
    authFetch('/api/listings/mine')
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .catch(() => setListings([]));
  }, []);

  const counts = {
    draft: listings?.filter((l) => l.status === 'draft').length ?? 0,
    active: listings?.filter((l) => l.status === 'active').length ?? 0,
    archived: listings?.filter((l) => l.status === 'archived').length ?? 0,
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">
          Welcome back, {me.sellerProfile.businessName}
        </h1>
        <p className="mt-1 font-body text-sm text-ink-soft">Here&apos;s how your store is doing.</p>
      </div>

      {!me.user.itsVerified && (
        <div className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold-soft/15 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" strokeWidth={2} />
          <div>
            <p className="font-body text-sm font-semibold text-ink">ITS verification pending</p>
            <p className="mt-0.5 font-body text-xs text-ink-soft">
              The Idara team reviews your ITS ID before your products can go live. You can still
              build out your catalogue as drafts in the meantime.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {listings === null ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
                <Skeleton className="h-8 w-10" />
                <Skeleton className="mt-2 h-3.5 w-16" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard label="Published" value={counts.active} />
            <StatCard label="Drafts" value={counts.draft} />
            <StatCard label="Archived" value={counts.archived} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/5">
            <Package className="h-5 w-5 text-navy" strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-body text-sm font-semibold text-ink">Manage your products</p>
            <p className="font-body text-xs text-ink-soft">Add, edit, publish, and track inventory.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/seller/products/new" className={buttonStyles('accent', 'sm')}>
            <PlusCircle className="h-3.5 w-3.5" strokeWidth={2} />
            Add product
          </Link>
          <Link href="/seller/products" className={buttonStyles('secondary', 'sm')}>
            View all
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
      <p className="font-heading text-3xl font-semibold text-navy">{value}</p>
      <p className="mt-1 font-body text-sm text-ink-soft">{label}</p>
    </div>
  );
}
