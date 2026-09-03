'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Package,
  ShoppingBag,
  MessageSquare,
  MessageCircle,
  Truck,
  Users2,
  Landmark,
  Flag,
  XCircle,
} from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { StatGridSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';

type Dashboard = {
  sellers: { total: number; verified: number; pendingVerification: number };
  buyers: { total: number };
  listings: {
    total: number;
    active: number;
    draft: number;
    flagged: number;
    byCategory: { categoryName: string; count: number }[];
  };
  orders: { total: number; last30d: number; grossValue: number };
  enquiries: { total: number; pending: number; slow: number };
  whatsappContacts: { total: number };
  pickups: { pending: number };
  payouts: { pendingCount: number; pendingAmount: number; failedCount: number };
  disputes: { openCount: number };
  refunds: { failedCount: number };
};

export default function AdminDashboardPage() {
  const { me } = useAdminPortal();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    authFetch('/api/admin/dashboard')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Welcome back, {me.name ?? me.email}. Here&apos;s the whole platform at a glance.
        </p>
      </div>

      {!data ? (
        <StatGridSkeleton count={8} />
      ) : (
        <>
          {/* Priority items — 2026-09-03 redesign, the things most likely
           *  to need Admin's attention TODAY (settlements, disputes, failed
           *  money-movement) always shown first, ahead of the standing
           *  totals below. */}
          {data.payouts.pendingCount > 0 && (
            <Link
              href="/admin/payouts"
              className="flex items-center gap-3 rounded-2xl border border-navy/15 bg-navy/5 p-4 transition hover:bg-navy/10"
            >
              <Landmark className="h-5 w-5 shrink-0 text-navy" strokeWidth={2} />
              <p className="font-body text-sm text-ink">
                <strong>₹{data.payouts.pendingAmount.toLocaleString('en-IN')}</strong> pending settlement
                across <strong>{data.payouts.pendingCount}</strong> payout{data.payouts.pendingCount === 1 ? '' : 's'}.
              </p>
            </Link>
          )}
          {data.disputes.openCount > 0 && (
            <Link
              href="/admin/disputes"
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
            >
              <Flag className="h-5 w-5 shrink-0 text-red-600" strokeWidth={2} />
              <p className="font-body text-sm text-ink">
                <strong>{data.disputes.openCount}</strong> dispute{data.disputes.openCount === 1 ? '' : 's'} open
                or under investigation.
              </p>
            </Link>
          )}
          {(data.payouts.failedCount > 0 || data.refunds.failedCount > 0) && (
            <Link
              href="/admin/payouts?status=failed"
              className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold-soft/15 p-4 transition hover:bg-gold-soft/25"
            >
              <XCircle className="h-5 w-5 shrink-0 text-gold" strokeWidth={2} />
              <p className="font-body text-sm text-ink">
                {data.payouts.failedCount > 0 && (
                  <>
                    <strong>{data.payouts.failedCount}</strong> payout{data.payouts.failedCount === 1 ? '' : 's'} failed
                  </>
                )}
                {data.payouts.failedCount > 0 && data.refunds.failedCount > 0 && ' · '}
                {data.refunds.failedCount > 0 && (
                  <>
                    <strong>{data.refunds.failedCount}</strong> refund{data.refunds.failedCount === 1 ? '' : 's'} failed
                  </>
                )}
                {' '}— needs a retry.
              </p>
            </Link>
          )}
          {data.sellers.pendingVerification > 0 && (
            <Link
              href="/admin/sellers?verified=pending"
              className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold-soft/15 p-4 transition hover:bg-gold-soft/25"
            >
              <ShieldAlert className="h-5 w-5 shrink-0 text-gold" strokeWidth={2} />
              <p className="font-body text-sm text-ink">
                <strong>{data.sellers.pendingVerification}</strong> seller
                {data.sellers.pendingVerification === 1 ? '' : 's'} waiting on ITS verification.
              </p>
            </Link>
          )}
          {data.enquiries.slow > 0 && (
            <Link
              href="/admin/enquiries"
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
            >
              <MessageSquare className="h-5 w-5 shrink-0 text-red-600" strokeWidth={2} />
              <p className="font-body text-sm text-ink">
                <strong>{data.enquiries.slow}</strong> enquir{data.enquiries.slow === 1 ? 'y' : 'ies'}{' '}
                pending 24+ hours with no seller response (FR-25).
              </p>
            </Link>
          )}
          {data.pickups.pending > 0 && (
            <Link
              href="/admin/pickups"
              className="flex items-center gap-3 rounded-2xl border border-navy/15 bg-navy/5 p-4 transition hover:bg-navy/10"
            >
              <Truck className="h-5 w-5 shrink-0 text-navy" strokeWidth={2} />
              <p className="font-body text-sm text-ink">
                <strong>{data.pickups.pending}</strong> jamaat parcel pickup
                {data.pickups.pending === 1 ? '' : 's'} awaiting receipt logging (FR-47).
              </p>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={ShieldCheck} label="Verified sellers" value={data.sellers.verified} sub={`${data.sellers.total} total`} />
            <StatCard icon={Users2} label="Registered buyers" value={data.buyers.total} />
            <StatCard icon={Package} label="Live products" value={data.listings.active} sub={`${data.listings.total} total`} />
            <StatCard icon={ShoppingBag} label="Orders (30d)" value={data.orders.last30d} sub={`${data.orders.total} total`} />
            <StatCard icon={Landmark} label="Payouts pending" value={data.payouts.pendingCount} sub={`₹${data.payouts.pendingAmount.toLocaleString('en-IN')}`} />
            <StatCard icon={Flag} label="Open disputes" value={data.disputes.openCount} />
            <StatCard icon={MessageSquare} label="Enquiries" value={data.enquiries.total} sub={`${data.enquiries.pending} pending`} />
            <StatCard icon={MessageCircle} label="WhatsApp handoffs" value={data.whatsappContacts.total} />
            <StatCard icon={Package} label="Draft products" value={data.listings.draft} />
            <StatCard icon={ShieldAlert} label="Flagged products" value={data.listings.flagged} />
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="mb-4 font-heading text-sm font-semibold text-ink">Products by category</h2>
            <div className="flex flex-col gap-3">
              {data.listings.byCategory.map((row) => {
                const max = Math.max(...data.listings.byCategory.map((r) => r.count), 1);
                return (
                  <div key={row.categoryName} className="flex items-center gap-3">
                    <p className="w-32 shrink-0 truncate font-body text-xs text-ink-soft">{row.categoryName}</p>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ivory-deep">
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{ width: `${(row.count / max) * 100}%` }}
                      />
                    </div>
                    <p className="w-8 shrink-0 text-right font-body text-xs font-semibold text-ink">{row.count}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="mb-1 font-heading text-sm font-semibold text-ink">Gross order value (all time)</h2>
            <p className="font-heading text-3xl font-semibold text-navy">
              ₹{data.orders.grossValue.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 font-body text-xs text-ink-soft">
              Reflects placed orders only — a COD order counts as order-intent value (nothing&apos;s
              actually collected until delivery), an online order only counts once it&apos;s genuinely
              paid.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/5">
        <Icon className="h-4 w-4 text-navy" strokeWidth={1.75} />
      </span>
      <p className="font-heading text-2xl font-semibold text-ink">{value.toLocaleString('en-IN')}</p>
      <p className="font-body text-xs text-ink-soft">{label}</p>
      {sub && <p className="font-body text-[11px] text-ink-soft/70">{sub}</p>}
    </div>
  );
}
