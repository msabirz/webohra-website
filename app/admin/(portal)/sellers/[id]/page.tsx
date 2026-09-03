'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Store,
  Package,
  Wallet,
  Landmark,
  Layers,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton, RowListSkeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';
import { InfoPopover } from '@/components/admin/info-popover';
import { PayoutMethodDisplay } from '@/components/admin/payout-method-display';

const RAZORPAYX_INFO =
  'Attempts to automatically send this seller her money through Razorpay, straight to her registered bank account or UPI ID — no manual transfer on your end. Only works once a super admin has approved RazorpayX in Settings; until then it fails safely with a clear message.';
const MANUAL_INFO =
  'Send her the amount yourself using whichever method she registered — scan her UPI QR, transfer to her bank details, or scan her uploaded QR image (shown below) — then confirm here. This records that she\'s been paid; it never moves money on its own.';

// See app/admin/(portal)/payouts/page.tsx's matching constant — same
// 2026-09-03 decision, kept in sync across both places this button shows.
const RAZORPAYX_UI_ENABLED = false;

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
  // null = different types, no single price of its own.
  price: string | null;
  status: string;
  subcategoryName: string;
  listingType: 'physical_product' | 'local_service' | 'remote_service';
  createdAt: string;
};

type Subscription = {
  sellerType: 'product' | 'service';
  billingMode: 'plan' | 'recharge';
  status: string;
  plan: { name: string; sellerType: string } | null;
};

type TopProduct = {
  listingId: number;
  title: string;
  status: string;
  listingType: 'physical_product' | 'local_service' | 'remote_service' | null;
  unitsSold: number;
  revenue: string;
};

type Overview = {
  wallet: { balance: string } | null;
  subscriptions: Subscription[];
  orderStats: { orderCount: number; gmv: string };
  payoutStats: { pendingAmount: string; processedAmount: string };
  topProducts: TopProduct[];
};

export default function AdminSellerDetailPage() {
  const params = useParams<{ id: string }>();
  const { me } = useAdminPortal();
  const canVerify = me.staffRole !== 'customer_support';
  const canPayout = me.staffRole === 'admin' || me.staffRole === 'super_admin';

  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [payingOut, setPayingOut] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [markingManual, setMarkingManual] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch(`/api/admin/sellers/${params.id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setSeller(data.seller);
    setListings(data.listings ?? []);
    setOverview({
      wallet: data.wallet,
      subscriptions: data.subscriptions ?? [],
      orderStats: data.orderStats,
      payoutStats: data.payoutStats,
      topProducts: data.topProducts ?? [],
    });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function payOutPending() {
    if (!seller) return;
    setPayingOut(true);
    setPayoutError(null);
    try {
      const res = await authFetch(`/api/admin/payouts/sellers/${seller.userId}/send-all`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setPayoutError(data.error ?? 'Could not send these payouts.');
      } else if (data.failed > 0) {
        setPayoutError(`${data.sent} sent, ${data.failed} failed — see /admin/payouts for details.`);
      }
      await load();
    } finally {
      setPayingOut(false);
    }
  }

  async function confirmManualPayout() {
    if (!seller) return;
    if (manualNote.trim().length < 5) {
      setPayoutError('Explain how you actually paid her (e.g. bank/UPI reference).');
      return;
    }
    setPayingOut(true);
    setPayoutError(null);
    try {
      const res = await authFetch(`/api/admin/payouts/sellers/${seller.userId}/mark-all-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: manualNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayoutError(data.error ?? 'Could not record this.');
        return;
      }
      if (data.failed > 0) {
        setPayoutError(`${data.marked} recorded, ${data.failed} failed — see /admin/payouts for details.`);
      }
      setMarkingManual(false);
      setManualNote('');
      await load();
    } finally {
      setPayingOut(false);
    }
  }

  if (notFound) {
    return <p className="font-body text-sm text-ink-soft">Seller not found.</p>;
  }

  if (!seller || !overview) {
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

  const pendingAmount = Number(overview.payoutStats.pendingAmount);

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

      {/* Earnings & wallet — everything real-money about this seller in
       *  one glance. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingBag}
          label="Lifetime orders (paid)"
          value={String(overview.orderStats.orderCount)}
          sub={`₹${Number(overview.orderStats.gmv).toLocaleString('en-IN')} GMV`}
        />
        <StatCard
          icon={TrendingUp}
          label="Paid out to date"
          value={`₹${Number(overview.payoutStats.processedAmount).toLocaleString('en-IN')}`}
        />
        <Link href={`/admin/wallets/${seller.userId}`} className="block">
          <StatCard
            icon={Wallet}
            label="Wallet balance"
            value={overview.wallet ? `₹${Number(overview.wallet.balance).toLocaleString('en-IN')}` : 'No wallet'}
            sub="View transactions →"
          />
        </Link>
        <div className="flex flex-col justify-between gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/5">
              <Landmark className="h-4 w-4 text-navy" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-body text-xs font-medium text-ink-soft">Payout pending</p>
              <p className="font-heading text-lg font-semibold text-ink">₹{pendingAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
          {canPayout && pendingAmount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {RAZORPAYX_UI_ENABLED && (
                <>
                  <button
                    onClick={payOutPending}
                    disabled={payingOut || markingManual}
                    className={buttonStyles('secondary', 'sm')}
                  >
                    {payingOut ? 'Sending…' : 'Send via RazorpayX'}
                  </button>
                  <InfoPopover text={RAZORPAYX_INFO} />
                </>
              )}
              <button
                onClick={() => {
                  setMarkingManual(true);
                  setManualNote('');
                  setPayoutError(null);
                }}
                disabled={payingOut || markingManual}
                className={buttonStyles('secondary', 'sm')}
              >
                Mark as paid manually
              </button>
              <InfoPopover text={MANUAL_INFO} align="right" />
            </div>
          )}
        </div>
      </div>

      {markingManual && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gold/30">
          <p className="font-body text-sm font-semibold text-ink">
            Pay ₹{pendingAmount.toLocaleString('en-IN')} — then record it here
          </p>
          <PayoutMethodDisplay sellerId={seller.userId} amountRupees={pendingAmount} orderNumber="batch payout" />
          <p className="font-body text-xs text-ink-soft">
            Once you&apos;ve actually sent it, record how below (bank/UPI reference, date) — this only saves the
            record, it never moves money itself.
          </p>
          <input
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="e.g. NEFT, ref #123456, 3 Sept"
            className={inputStyles}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={confirmManualPayout} disabled={payingOut} className={buttonStyles('primary', 'sm')}>
              {payingOut ? 'Saving…' : 'Confirm — record as paid'}
            </button>
            <button onClick={() => setMarkingManual(false)} className={buttonStyles('secondary', 'sm')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {payoutError && <p className="font-body text-sm text-red-700">{payoutError}</p>}

      {/* Subscriptions */}
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Layers className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Subscription
        </h2>
        {overview.subscriptions.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
            No subscription yet — she can&apos;t publish until she chooses one.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.subscriptions.map((s) => (
              <div key={s.sellerType} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
                <p className="font-body text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {s.sellerType}
                </p>
                <p className="mt-0.5 font-body text-sm font-semibold text-ink">
                  {s.plan?.name ?? 'No plan resolved'}
                  {s.billingMode === 'recharge' && ' (pay as you go)'}
                </p>
                <p className="font-body text-xs text-ink-soft">{s.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top products */}
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <TrendingUp className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Best-selling
        </h2>
        {overview.topProducts.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
            No paid orders yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {overview.topProducts.map((p, i) => (
              <div
                key={p.listingId}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-ink-soft/5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 font-body text-xs font-bold text-ink">
                    {i + 1}
                  </span>
                  <p className="font-body text-sm text-ink">{p.title}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-xs text-ink-soft">{p.unitsSold} sold</span>
                  <span className="font-body text-sm font-medium text-navy">
                    ₹{Number(p.revenue).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                    {l.price !== null ? `₹${Number(l.price).toLocaleString('en-IN')}` : 'Multiple types'}
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:ring-navy/20">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/5">
        <Icon className="h-4 w-4 text-navy" strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-body text-xs font-medium text-ink-soft">{label}</p>
        <p className="font-heading text-lg font-semibold text-ink">{value}</p>
        {sub && <p className="font-body text-xs text-ink-soft">{sub}</p>}
      </div>
    </div>
  );
}
