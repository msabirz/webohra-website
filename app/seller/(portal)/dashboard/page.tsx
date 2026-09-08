'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  PlusCircle,
  ShieldAlert,
  ArrowRight,
  Wallet,
  IndianRupee,
  AlertTriangle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { useSellerPortal } from '@/lib/seller-context';
import { Skeleton } from '@/components/skeleton';
import { DailyBarChart } from '@/components/daily-bar-chart';

type Plan = {
  name: string;
  monthlyPrice: string;
  maxActiveListings: number | null;
} | null;

type Subscription = {
  sellerType: 'product' | 'service';
  billingMode: 'plan' | 'recharge';
  status: string;
  renewsAt: string | null;
  plan: Plan;
};

type DashboardData = {
  wallet: { balance: string } | null;
  listings: { active: number; draft: number; archived: number };
  orders: { total: number; last30dCount: number; last30dGmv: number };
  disputes: { openCount: number };
  subscriptions: Subscription[];
  daily: { date: string; orders: number; gmv: number }[];
};

/**
 * /seller/dashboard — item 30 (2026-09-07) redesign. The old version was
 * just three listing-count tiles and a "manage products" card — a real
 * gap the user called out directly: no wallet balance, no verification
 * status beyond a pending-only banner, no orders/revenue context, no
 * subscription status, nothing resembling an actual "how's my store
 * doing" view. Backed by GET /api/sellers/dashboard, one aggregate call
 * mirroring the exact same shape /api/admin/dashboard already uses.
 */
export default function SellerDashboardPage() {
  const { me } = useSellerPortal();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    authFetch('/api/sellers/dashboard')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="flex flex-col gap-6">
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

      {data === null ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3.5 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* High-level stat row — wallet, revenue, listings, disputes in
             one glance, none of which the old dashboard showed at all. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Wallet}
              label="Wallet balance"
              value={`₹${Number(data.wallet?.balance ?? 0).toLocaleString('en-IN')}`}
              tone={data.wallet && Number(data.wallet.balance) < 0 ? 'warn' : undefined}
              href="/seller/wallet"
            />
            <StatCard
              icon={IndianRupee}
              label="Revenue, last 30 days"
              value={`₹${data.orders.last30dGmv.toLocaleString('en-IN')}`}
              sub={`${data.orders.last30dCount} order${data.orders.last30dCount === 1 ? '' : 's'}`}
              href="/seller/orders"
            />
            <StatCard icon={Package} label="Active listings" value={data.listings.active} href="/seller/products" />
            <StatCard
              icon={AlertTriangle}
              label="Open disputes"
              value={data.disputes.openCount}
              tone={data.disputes.openCount > 0 ? 'warn' : undefined}
              href="/seller/disputes"
            />
          </div>

          {/* Trend — same hand-rolled bar chart as /admin/analytics, scoped
             to her own orders only. 14 days, not 30/90 — a compact "recent
             pulse" view fits a dashboard better than a full analytics page
             (which /admin/analytics already is, for the platform as a
             whole; this deliberately isn't trying to be that). */}
          <div className="grid gap-4 sm:grid-cols-2">
            <DailyBarChart title="Your orders per day (14d)" values={data.daily.map((d) => ({ label: d.date.slice(5), value: d.orders }))} />
            <DailyBarChart
              title="Your revenue per day (14d)"
              values={data.daily.map((d) => ({ label: d.date.slice(5), value: d.gmv }))}
              format={(v) => `₹${v.toLocaleString('en-IN')}`}
            />
          </div>

          {/* Subscription status — one card per seller_type she holds.
             The old dashboard never mentioned her plan at all; she'd only
             find out it lapsed by hitting a publish-gate error later. */}
          {data.subscriptions.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.subscriptions.map((s) => (
                <SubscriptionCard key={s.sellerType} subscription={s} />
              ))}
            </div>
          )}
        </>
      )}

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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'warn';
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone === 'warn' ? 'bg-red-50' : 'bg-navy/5'}`}>
        <Icon className={`h-4 w-4 ${tone === 'warn' ? 'text-red-500' : 'text-navy'}`} strokeWidth={1.75} />
      </span>
      <p className={`font-heading text-2xl font-semibold ${tone === 'warn' ? 'text-red-600' : 'text-ink'}`}>{value}</p>
      <p className="font-body text-xs text-ink-soft">{label}</p>
      {sub && <p className="font-body text-[11px] text-ink-soft/70">{sub}</p>}
    </Link>
  );
}

function SubscriptionCard({ subscription: s }: { subscription: Subscription }) {
  const label = s.sellerType === 'product' ? 'Product plan' : 'Service plan';
  return (
    <Link
      href="/seller/subscription"
      className="flex items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/5">
          <Layers className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-body text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
          <p className="font-body text-sm font-semibold text-ink">
            {s.billingMode === 'recharge' ? 'Pay as you go' : (s.plan?.name ?? 'No plan resolved')}
          </p>
          {s.billingMode === 'plan' && s.renewsAt && (
            <p className="font-body text-xs text-ink-soft">
              Renews {new Date(s.renewsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          )}
          {s.status === 'lapsed' && <p className="font-body text-xs font-medium text-red-500">Expired — renew to keep publishing</p>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft/50" strokeWidth={2} />
    </Link>
  );
}
