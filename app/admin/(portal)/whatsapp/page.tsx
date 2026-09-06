'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, CheckCheck, PhoneCall, IndianRupee } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { StatGridSkeleton } from '@/components/skeleton';

type SellerRow = {
  sellerId: number;
  businessName: string | null;
  connectSent: number;
  connectBilled: number;
  connectAmount: number;
  leadCount: number;
  leadAmount: number;
};
type Summary = {
  range: { key: string; days: number };
  totals: { connectSent: number; connectBilled: number; connectAmount: number; leadCount: number; leadAmount: number };
  bySeller: SellerRow[];
};
type WhatsAppContact = {
  id: number;
  buyerName: string;
  createdAt: string;
  listingTitle: string;
  businessName: string | null;
};

const RANGES: { key: string; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

/**
 * Tier 3, item 19 — the admin aggregate dashboard WhatsApp Connect &
 * Lead never had: only per-message tracking existed before this (the
 * POC demo page, one row at a time).
 */
export default function AdminWhatsAppPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<Summary | null>(null);
  const [contacts, setContacts] = useState<WhatsAppContact[] | null>(null);

  useEffect(() => {
    setData(null);
    authFetch(`/api/admin/whatsapp?range=${range}`)
      .then((res) => res.json())
      .then(setData);
  }, [range]);

  // Basic-tier phone/email reveal + every other "Contact Seller" click —
  // deliberately free, click-tracking only, never billed (see this
  // page's own top comment). The endpoint already existed
  // (GET /api/admin/whatsapp-contacts) but had no admin UI anywhere to
  // actually see it — bonus catch while building this page, wired in
  // rather than left orphaned.
  useEffect(() => {
    authFetch('/api/admin/whatsapp-contacts')
      .then((res) => res.json())
      .then((d) => setContacts(d.contacts ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">WhatsApp Connect &amp; Lead</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Volume and billing per seller — Meta Cloud API, WE Bohra&apos;s own number.
          </p>
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
        <StatGridSkeleton count={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={MessageCircle} label="Connects sent" value={data.totals.connectSent.toLocaleString('en-IN')} />
            <StatCard
              icon={CheckCheck}
              label="Connects billed"
              value={data.totals.connectBilled.toLocaleString('en-IN')}
              sub={`₹${data.totals.connectAmount.toLocaleString('en-IN')}`}
            />
            <StatCard icon={PhoneCall} label="Leads" value={data.totals.leadCount.toLocaleString('en-IN')} />
            <StatCard
              icon={IndianRupee}
              label="Total billed"
              value={`₹${(data.totals.connectAmount + data.totals.leadAmount).toLocaleString('en-IN')}`}
            />
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="mb-4 font-heading text-sm font-semibold text-ink">By seller</h2>
            {data.bySeller.length === 0 ? (
              <p className="font-body text-sm text-ink-soft">No Connect or Lead activity in this window yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse font-body text-sm">
                  <thead>
                    <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                      <th className="py-2 pr-2">Seller</th>
                      <th className="px-2 py-2">Connects sent</th>
                      <th className="px-2 py-2">Billed</th>
                      <th className="px-2 py-2">Connect ₹</th>
                      <th className="px-2 py-2">Leads</th>
                      <th className="px-2 py-2">Lead ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySeller.map((s) => (
                      <tr key={s.sellerId} className="border-b border-ink-soft/5 last:border-0">
                        <td className="py-2 pr-2 text-ink">{s.businessName ?? `Seller #${s.sellerId}`}</td>
                        <td className="px-2 py-2 text-ink-soft">{s.connectSent}</td>
                        <td className="px-2 py-2 text-ink-soft">{s.connectBilled}</td>
                        <td className="px-2 py-2 font-semibold text-navy">₹{s.connectAmount.toLocaleString('en-IN')}</td>
                        <td className="px-2 py-2 text-ink-soft">{s.leadCount}</td>
                        <td className="px-2 py-2 font-semibold text-navy">₹{s.leadAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="mb-1 font-heading text-sm font-semibold text-ink">Recent Contact Seller clicks</h2>
            <p className="mb-4 font-body text-xs text-ink-soft">
              Free, click-tracking only — never billed. Includes Basic-tier phone/email reveal, the deliberate permanent free tier.
            </p>
            {contacts === null ? (
              <p className="font-body text-sm text-ink-soft">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="font-body text-sm text-ink-soft">No clicks logged yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {contacts.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 border-b border-ink-soft/5 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm text-ink">
                        {c.buyerName} → {c.listingTitle}
                      </p>
                      <p className="truncate font-body text-xs text-ink-soft">{c.businessName}</p>
                    </div>
                    <span className="shrink-0 font-body text-xs text-ink-soft">
                      {new Date(c.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/5">
        <Icon className="h-4 w-4 text-navy" strokeWidth={1.75} />
      </span>
      <p className="font-heading text-xl font-semibold text-ink">{value}</p>
      <p className="font-body text-xs text-ink-soft">{label}</p>
      {sub && <p className="font-body text-[11px] text-ink-soft/70">{sub}</p>}
    </div>
  );
}
