'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * TEMPORARY stakeholder-preview page — 2026-09-05, rewritten crisp/short
 * for an exec read (full detail lives in app/seller/webohrabusiness and
 * the memory backlog). Public, no auth, not linked from the live site.
 * Shows real, live subscription_plans data via the existing public GET
 * /api/subscription-plans endpoint.
 */

type Plan = {
  id: number;
  sellerType: 'product' | 'service';
  tierKey: string;
  name: string;
  monthlyPrice: string;
};

export default function SellerPricingPreviewPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [view, setView] = useState<'product' | 'service'>('product');

  useEffect(() => {
    fetch('/api/subscription-plans')
      .then((r) => r.json())
      .then((data) => setPlans(data.plans ?? []));
  }, []);

  const shown = plans.filter((p) => p.sellerType === view);

  return (
    <div className="min-h-screen bg-ivory font-body text-ink">
      <nav className="flex items-center justify-between border-b border-ink-soft/15 bg-white px-6 py-4">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-navy-deep">
          <span className="h-2 w-2 rounded-full bg-gold" />
          WE Bohra Seller · Pricing
        </div>
        <Link href="/seller/webohrabusiness" className="text-sm font-semibold text-ink-soft hover:text-navy">
          Business case →
        </Link>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-9">
        <div className="mb-6 rounded-lg border border-gold/50 bg-gold-soft/20 px-4 py-2 text-center text-xs font-semibold text-ink-soft">
          Preview — not live
        </div>

        <h1 className="mb-1 font-heading text-2xl font-bold text-navy-deep">Wallet now. Fixed plans in a few months.</h1>
        <p className="mb-7 text-[14px] text-ink-soft">No monthly bill at launch. Sellers pay only when they get real business.</p>

        {/* the 3 numbers that matter */}
        <div className="mb-7 grid grid-cols-3 gap-3">
          {[
            ['10%', 'Commission', 'on a completed sale'],
            ['₹20', 'WhatsApp Connect', 'per verified chat'],
            ['₹35', 'WhatsApp Lead', 'per portal request'],
          ].map(([num, label, sub]) => (
            <div key={label} className="rounded-2xl bg-navy p-5 text-center text-white">
              <div className="font-heading text-3xl font-bold text-gold-soft">{num}</div>
              <div className="mt-1 text-[13px] font-semibold">{label}</div>
              <div className="text-[11px] text-[#B9C6DD]">{sub}</div>
            </div>
          ))}
        </div>

        <p className="mb-7 text-[13px] text-ink-soft">
          All three deducted from her wallet only after WE Bohra can prove the event happened — a sale, a verified
          WhatsApp chat, or a delivered lead. Nothing is ever added to what the buyer pays.
        </p>

        {/* fixed plans preview, compact table not cards */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-navy-deep">Fixed plans — coming later</h2>
          <div className="inline-flex rounded-full border border-ink-soft/15 bg-white p-0.5 text-xs">
            <button onClick={() => setView('product')} className={`rounded-full px-3 py-1 font-bold ${view === 'product' ? 'bg-navy text-white' : 'text-ink-soft'}`}>Products</button>
            <button onClick={() => setView('service')} className={`rounded-full px-3 py-1 font-bold ${view === 'service' ? 'bg-navy text-white' : 'text-ink-soft'}`}>Services</button>
          </div>
        </div>
        <div className="mb-8 overflow-hidden rounded-xl border border-ink-soft/15 bg-white">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-ivory-deep text-ink-soft">
                <th className="px-4 py-2 font-bold">Plan</th>
                <th className="px-4 py-2 text-right font-bold">Price/mo</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-ink-soft/10">
                  <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-navy-deep">
                    {Number(p.monthlyPrice) === 0 ? 'Free' : `₹${Number(p.monthlyPrice).toLocaleString('en-IN')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="text-center text-xs text-ink-soft">Preview, 2026-09-05 · full detail: business case page</footer>
      </div>
    </div>
  );
}
