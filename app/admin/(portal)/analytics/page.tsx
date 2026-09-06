'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingBag, IndianRupee, Users2, ShieldCheck, Download } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { StatGridSkeleton } from '@/components/skeleton';

type Daily = { date: string; orders: number; gmv: number };
type TopSeller = { sellerId: number; businessName: string | null; orders: number; gmv: number };
type TopCategory = { categoryName: string; orders: number; gmv: number };
type Analytics = {
  range: { key: string; days: number };
  summary: { orders: number; gmv: number; newBuyers: number; newSellers: number; avgOrderValue: number };
  daily: Daily[];
  topSellers: TopSeller[];
  topCategories: TopCategory[];
};

const RANGES: { key: string; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

/**
 * Tier 3, item 18 (2026-09-06) — the "over time" page /admin/dashboard
 * never had: trends, top-sellers, time-series, export, all genuinely
 * absent before this (see the API route's own comment). /admin/dashboard
 * itself is untouched — this is a separate page, not a rework of that
 * one.
 */
export default function AdminAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    setData(null);
    authFetch(`/api/admin/analytics?range=${range}`)
      .then((res) => res.json())
      .then(setData);
  }, [range]);

  function exportDailyCsv() {
    if (!data) return;
    const header = ['Date', 'Orders', 'GMV'];
    const lines = data.daily.map((d) => [d.date, d.orders, d.gmv.toFixed(2)].join(','));
    downloadCsv([header.join(','), ...lines].join('\n'), `we-bohra-daily-trend-${range}`);
  }

  function exportTopSellersCsv() {
    if (!data) return;
    const header = ['Business name', 'Orders', 'GMV'];
    const lines = data.topSellers.map((s) =>
      [`"${(s.businessName ?? `Seller #${s.sellerId}`).replace(/"/g, '""')}"`, s.orders, s.gmv.toFixed(2)].join(','),
    );
    downloadCsv([header.join(','), ...lines].join('\n'), `we-bohra-top-sellers-${range}`);
  }

  function exportTopCategoriesCsv() {
    if (!data) return;
    const header = ['Category', 'Orders', 'GMV'];
    const lines = data.topCategories.map((c) =>
      [`"${c.categoryName.replace(/"/g, '""')}"`, c.orders, c.gmv.toFixed(2)].join(','),
    );
    downloadCsv([header.join(','), ...lines].join('\n'), `we-bohra-top-categories-${range}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Analytics</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">Trends over time — Dashboard stays the at-a-glance view.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-ink-soft/5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3.5 py-1.5 font-body text-xs font-semibold transition ${
                range === r.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <StatGridSkeleton count={5} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard icon={ShoppingBag} label="Orders" value={data.summary.orders.toLocaleString('en-IN')} />
            <StatCard icon={IndianRupee} label="GMV" value={`₹${data.summary.gmv.toLocaleString('en-IN')}`} />
            <StatCard
              icon={TrendingUp}
              label="Avg order value"
              value={`₹${Math.round(data.summary.avgOrderValue).toLocaleString('en-IN')}`}
            />
            <StatCard icon={Users2} label="New buyers" value={data.summary.newBuyers.toLocaleString('en-IN')} />
            <StatCard icon={ShieldCheck} label="New sellers" value={data.summary.newSellers.toLocaleString('en-IN')} />
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={exportDailyCsv}
              disabled={data.daily.length === 0}
              className="flex items-center gap-1.5 font-body text-xs font-medium text-navy underline underline-offset-2 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Export daily trend CSV
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DailyBarChart title="Orders per day" values={data.daily.map((d) => ({ label: d.date, value: d.orders }))} />
            <DailyBarChart
              title="GMV per day"
              values={data.daily.map((d) => ({ label: d.date, value: d.gmv }))}
              format={(v) => `₹${v.toLocaleString('en-IN')}`}
            />
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-sm font-semibold text-ink">Top sellers</h2>
              <button
                onClick={exportTopSellersCsv}
                disabled={data.topSellers.length === 0}
                className="flex items-center gap-1.5 font-body text-xs font-medium text-navy underline underline-offset-2 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Export CSV
              </button>
            </div>
            {data.topSellers.length === 0 ? (
              <p className="font-body text-sm text-ink-soft">No orders in this window yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse font-body text-sm">
                  <thead>
                    <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                      <th className="py-2 pr-2">Seller</th>
                      <th className="px-2 py-2">Orders</th>
                      <th className="px-2 py-2">GMV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topSellers.map((s) => (
                      <tr key={s.sellerId} className="border-b border-ink-soft/5 last:border-0">
                        <td className="py-2 pr-2 text-ink">{s.businessName ?? `Seller #${s.sellerId}`}</td>
                        <td className="px-2 py-2 text-ink-soft">{s.orders}</td>
                        <td className="px-2 py-2 font-semibold text-navy">₹{s.gmv.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-heading text-sm font-semibold text-ink">Top categories by GMV</h2>
              <button
                onClick={exportTopCategoriesCsv}
                disabled={data.topCategories.length === 0}
                className="flex items-center gap-1.5 font-body text-xs font-medium text-navy underline underline-offset-2 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Export CSV
              </button>
            </div>
            {data.topCategories.length === 0 ? (
              <p className="font-body text-sm text-ink-soft">No orders in this window yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.topCategories.map((c) => {
                  const max = Math.max(...data.topCategories.map((r) => r.gmv), 1);
                  return (
                    <div key={c.categoryName} className="flex items-center gap-3">
                      <p className="w-32 shrink-0 truncate font-body text-xs text-ink-soft">{c.categoryName}</p>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ivory-deep">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(c.gmv / max) * 100}%` }} />
                      </div>
                      <p className="w-24 shrink-0 text-right font-body text-xs font-semibold text-ink">
                        ₹{c.gmv.toLocaleString('en-IN')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function downloadCsv(content: string, filenameBase: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/5">
        <Icon className="h-4 w-4 text-navy" strokeWidth={1.75} />
      </span>
      <p className="font-heading text-xl font-semibold text-ink">{value}</p>
      <p className="font-body text-xs text-ink-soft">{label}</p>
    </div>
  );
}

/** No charting library in this project — a small vertical bar chart built
 *  from plain divs, same "hand-rolled, no new dependency" style as the
 *  dashboard's existing "Products by category" bar list. Bars are simple
 *  height percentages of the window's max value; hover shows the exact
 *  figure via the title attribute since there's no tooltip component to
 *  reach for either. */
function DailyBarChart({
  title,
  values,
  format,
}: {
  title: string;
  values: { label: string; value: number }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...values.map((v) => v.value), 1);
  const fmt = format ?? ((v: number) => v.toLocaleString('en-IN'));
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">{title}</h2>
      <div className="flex h-32 items-end gap-[2px]">
        {values.map((v) => (
          <div
            key={v.label}
            title={`${v.label}: ${fmt(v.value)}`}
            className="flex-1 rounded-t bg-navy/70 transition hover:bg-navy"
            style={{ height: `${Math.max((v.value / max) * 100, v.value > 0 ? 4 : 1)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-body text-[10px] text-ink-soft">
        <span>{values[0]?.label}</span>
        <span>{values[values.length - 1]?.label}</span>
      </div>
    </div>
  );
}
