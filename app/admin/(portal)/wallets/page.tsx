'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Wallet } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type WalletRow = {
  sellerId: number;
  balance: string;
  name: string | null;
  email: string | null;
  phone: string;
  businessName: string | null;
};

/**
 * /admin/wallets — Fulfillment & Subscriptions redesign, Phase 5. Every
 * seller who's opted into recharge or topped up at least once (a plan-
 * billed seller has no wallet row and won't appear here — see the API
 * route's own comment). Click through to see her full transaction history
 * and, for Admin, make a manual adjustment.
 */
export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[] | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    setWallets(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const res = await authFetch(`/api/admin/wallets?${params}`);
    const data = await res.json();
    setWallets(data.wallets ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Wallets</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Every seller on pay-as-you-go — real balance, real Razorpay top-ups, and manual adjustments when needed.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="relative sm:w-96"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business, name, email, phone…"
          className={`${inputStyles} w-full pl-9`}
        />
      </form>

      {wallets === null ? (
        <RowListSkeleton count={4} />
      ) : wallets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Wallet className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No wallets yet — no seller has opted into pay-as-you-go.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {wallets.map((w) => (
            <Link
              key={w.sellerId}
              href={`/admin/wallets/${w.sellerId}`}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:ring-navy/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
                  <Wallet className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-ink">
                    {w.businessName ?? w.name ?? w.email ?? w.phone}
                  </p>
                  <p className="truncate font-body text-xs text-ink-soft">
                    {w.name ?? w.email ?? w.phone}
                    {w.businessName && (w.name || w.email) ? ` · ${w.phone}` : ''}
                  </p>
                </div>
              </div>
              <span className="self-end font-body text-lg font-semibold tabular-nums text-navy sm:self-auto">
                ₹{Number(w.balance).toLocaleString('en-IN')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
