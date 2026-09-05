'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * TEMPORARY stakeholder-preview page — 2026-09-05. Public, no auth
 * (deliberately outside both app/seller/(portal) and app/seller/(auth),
 * so it inherits neither's layout/session gate). Shows the real, live
 * subscription_plans data via the existing public GET
 * /api/subscription-plans endpoint (never queries the db directly, per
 * the one non-negotiable rule) alongside the wallet-first launch
 * strategy, which is a PROPOSAL — not yet built — clearly labeled as
 * such throughout. Remove this route once the wallet-first launch
 * strategy is finalized and either a real public pricing page or none
 * at all is decided.
 */

type Plan = {
  id: number;
  sellerType: 'product' | 'service';
  tierKey: string;
  name: string;
  monthlyPrice: string;
  maxActiveListings: number | null;
  allowsPickupAndPay: boolean;
  pickupOfficeOption: boolean;
  allowsDelhivery: boolean;
  prioritySupport: boolean;
  remindersEnabled: boolean;
  contactMode: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
  bonusOtherCategoryListings: number;
};

const CONTACT_LABEL: Record<string, string> = {
  whatsapp_number: 'Plain number/email',
  direct_whatsapp: 'Direct WhatsApp',
  masked_relay: 'Masked relay via portal',
};

function Feature({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span
        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? 'bg-teal/15 text-teal-deep' : 'bg-ivory-deep text-ink-soft'
        }`}
      >
        {ok ? '✓' : '–'}
      </span>
      <span className={ok ? 'text-ink' : 'text-ink-soft'}>{children}</span>
    </li>
  );
}

function PlanCard({ plan, tone }: { plan: Plan; tone: 'default' | 'featured' | 'diamond' }) {
  const price = Number(plan.monthlyPrice);
  const isService = plan.sellerType === 'service';

  const base = 'flex flex-col gap-3 rounded-2xl border p-5';
  const toneClass =
    tone === 'diamond'
      ? 'bg-gradient-to-br from-navy to-navy-deep border-navy-deep text-ivory'
      : tone === 'featured'
        ? 'bg-white border-2 border-gold'
        : 'bg-white border-ink-soft/15';

  return (
    <div className={`${base} ${toneClass} relative opacity-60 grayscale-[0.3]`}>
      {tone === 'featured' && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
          Expected most chosen
        </span>
      )}
      <div className={`font-heading text-lg font-semibold ${tone === 'diamond' ? 'text-white' : 'text-navy-deep'}`}>
        {plan.name}
      </div>
      <div className={`font-heading text-3xl font-bold tabular-nums ${tone === 'diamond' ? 'text-white' : 'text-navy-deep'}`}>
        {price === 0 ? <span className="text-teal-deep">₹0</span> : `₹${price.toLocaleString('en-IN')}`}
      </div>
      <div className={`text-xs ${tone === 'diamond' ? 'text-[#C7D3E5]' : 'text-ink-soft'}`}>
        {price === 0 ? 'forever' : 'per month'}
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {isService ? (
          <>
            <Feature ok>{plan.maxActiveListings ?? 'Unlimited'} active listing{plan.maxActiveListings === 1 ? '' : 's'}</Feature>
            <Feature ok>Contact: {plan.contactMode ? CONTACT_LABEL[plan.contactMode] : 'Plain number/email'}</Feature>
            <Feature ok={plan.prioritySupport}>Priority support</Feature>
            <Feature ok={plan.bonusOtherCategoryListings > 0}>
              {plan.bonusOtherCategoryListings > 0 ? `+${plan.bonusOtherCategoryListings} bonus category listing${plan.bonusOtherCategoryListings > 1 ? 's' : ''}` : 'Bonus category listings'}
            </Feature>
          </>
        ) : (
          <>
            <Feature ok>{plan.maxActiveListings ?? 'Unlimited'} listing{plan.maxActiveListings === 1 ? '' : 's'}</Feature>
            <Feature ok={plan.allowsPickupAndPay}>Pickup &amp; Pay</Feature>
            <Feature ok={plan.pickupOfficeOption}>Pickup office option</Feature>
            <Feature ok={plan.allowsDelhivery}>Delhivery shipping</Feature>
            <Feature ok={plan.prioritySupport}>Priority support{plan.remindersEnabled ? ' + reminders' : ''}</Feature>
            <Feature ok={plan.bonusOtherCategoryListings > 0}>
              {plan.bonusOtherCategoryListings > 0 ? `+${plan.bonusOtherCategoryListings} bonus category listings` : 'Bonus category listings'}
            </Feature>
          </>
        )}
      </ul>
      <button
        disabled
        className={`mt-1 w-full cursor-not-allowed rounded-lg border py-2.5 text-sm font-bold ${
          tone === 'diamond'
            ? 'border-gold-soft bg-gold-soft text-navy-deep'
            : tone === 'featured'
              ? 'border-gold bg-gold text-white'
              : 'border-navy text-navy'
        }`}
      >
        Not open yet
      </button>
    </div>
  );
}

export default function SellerPricingPreviewPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'product' | 'service'>('product');

  useEffect(() => {
    fetch('/api/subscription-plans')
      .then((r) => r.json())
      .then((data) => setPlans(data.plans ?? []))
      .finally(() => setLoading(false));
  }, []);

  const shown = plans.filter((p) => p.sellerType === view);
  const featuredTier = view === 'product' ? 'gold' : 'silver';
  const diamondTier = view === 'product' ? 'diamond' : 'gold';

  return (
    <div className="min-h-screen bg-ivory font-body text-ink">
      {/* simulated top nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-soft/15 bg-white px-6 py-4">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-navy-deep">
          <span className="h-2 w-2 rounded-full bg-gold" />
          WE Bohra Seller
        </div>
        <div className="hidden gap-7 text-sm font-semibold sm:flex">
          <span className="text-ink-soft">Home</span>
          <span className="text-ink-soft">How it works</span>
          <span className="border-b-2 border-gold pb-1 text-navy">Pricing</span>
          <span className="text-ink-soft">Success stories</span>
        </div>
        <Link href="/seller/become" className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white">
          Start selling
        </Link>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-11">
        <div className="mb-2 rounded-lg border border-gold/50 bg-gold-soft/20 px-4 py-2 text-center text-xs font-semibold text-ink-soft">
          Temporary stakeholder preview — not linked from the live site.
        </div>

        <header className="mb-8 text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-gold">WE Bohra Seller Portal · Pricing</div>
          <h1 className="mb-3 font-heading text-3xl font-bold text-navy-deep">Start with the Wallet — no plan to pick yet</h1>
          <p className="mx-auto max-w-xl text-[15px] text-ink-soft">
            WE Bohra is launching with one simple way to sell: fund your Wallet, get every feature unlocked, and only ever
            pay for what you actually sell. Fixed monthly plans are coming in a few months — you can see a preview below.
          </p>
        </header>

        {/* wallet hero */}
        <div className="mb-8 grid grid-cols-1 gap-7 rounded-2xl bg-gradient-to-br from-navy to-navy-deep p-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="mb-3 inline-block rounded-full bg-gold-soft px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[#4A3712]">
              WE Bohra&apos;s first plan
            </span>
            <h2 className="mb-2 font-heading text-2xl font-bold text-white">Fund your Wallet, get everything unlocked</h2>
            <p className="mb-4 max-w-md text-sm text-[#D7DEEA]">
              No monthly bill, no tier to choose. Recharge any time — a minimum of ₹500 to start — and every feature is
              switched on from day one: unlimited listings, Pickup &amp; Pay, Delhivery shipping, priority support.
            </p>
            <ul className="mb-5 list-disc space-y-1.5 pl-5 text-[13.5px] text-[#D7DEEA]">
              <li>Commission, payment processing, and delivery cost (only if you use Delhivery) are deducted automatically once your order settles</li>
              <li>Nothing added to what your buyer pays</li>
              <li>Listings pause if your balance runs below ₹100 — top up any time to resume</li>
            </ul>
            <Link href="/seller/wallet" className="inline-block rounded-lg bg-gold px-7 py-3 text-sm font-bold text-white">
              Set up my Wallet
            </Link>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 p-5">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#8FA4C7]">
              Example: a ₹1,500 order, shipped via Delhivery
            </div>
            <div className="flex justify-between border-b border-white/20 py-2.5 text-[13.5px] text-white">
              <span>Buyer pays</span>
              <span className="font-bold tabular-nums">₹1,500.00</span>
            </div>
            {[
              ['− Commission (WE Bohra’s fee, 10%)', '− ₹150.00'],
              ['− Payment processing (Razorpay’s fee)', '− ₹35.40'],
              ['− Delhivery shipping (real courier cost)', '− ₹80.00'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between border-b border-dashed border-white/15 py-2 text-[13px] text-[#D7DEEA]">
                <span>{label}</span>
                <span className="font-bold tabular-nums text-white">{val}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-white/20 py-2.5 text-[13.5px] text-white">
              <span>Paid out to you (the seller)</span>
              <span className="font-bold tabular-nums text-gold-soft">₹1,234.60</span>
            </div>
            <div className="flex justify-between pt-2.5 text-[13px] text-[#D7DEEA]">
              <span>WE Bohra actually keeps</span>
              <span className="font-bold tabular-nums text-white">₹150.00</span>
            </div>
            <div className="mt-1 text-[11px] leading-snug text-[#8FA4C7]">
              Only the commission is WE Bohra&apos;s revenue — the Razorpay fee and Delhivery cost are recovered here, then paid straight through to Razorpay and Delhivery. WE Bohra never keeps them.
            </div>
          </div>
        </div>

        {/* coming soon: fixed plans */}
        <div className="my-9 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-ink-soft/20" />
          What&apos;s coming in a few months
          <span className="h-px flex-1 bg-ink-soft/20" />
        </div>

        <div className="mb-3 rounded-lg border border-dashed border-gold bg-ivory-deep px-4 py-2.5 text-center text-[12.5px] font-bold text-[#6B5411]">
          🔒 Fixed monthly plans — not open yet. Live figures shown below (pulled from the real database), everyone starts
          on the Wallet for now.
        </div>

        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-full border border-ink-soft/15 bg-white p-1 shadow-sm">
            <button
              onClick={() => setView('product')}
              className={`rounded-full px-6 py-2 text-sm font-bold ${view === 'product' ? 'bg-navy text-white' : 'text-ink-soft'}`}
            >
              I sell Products
            </button>
            <button
              onClick={() => setView('service')}
              className={`rounded-full px-6 py-2 text-sm font-bold ${view === 'service' ? 'bg-navy text-white' : 'text-ink-soft'}`}
            >
              I sell Services
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-sm text-ink-soft">Loading live plan data…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {shown.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                tone={plan.tierKey === diamondTier ? 'diamond' : plan.tierKey === featuredTier ? 'featured' : 'default'}
              />
            ))}
          </div>
        )}

        {/* custom */}
        <div className="my-9 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-ink-soft/20" />
          Something bigger?
          <span className="h-px flex-1 bg-ink-soft/20" />
        </div>
        <div className="mx-auto max-w-md rounded-2xl border border-ink-soft/15 bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ivory-deep text-lg">✦</div>
          <h3 className="mb-1 font-heading text-lg font-semibold text-navy-deep">
            Custom plan{' '}
            <span className="ml-1 rounded bg-gold-soft px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase text-[#5C4415]">
              Proposed
            </span>
          </h3>
          <p className="mb-3 text-[13.5px] text-ink-soft">
            Run a large catalog, need a bespoke commission rate, or want terms none of the above quite fit? We&apos;ll
            work out something that does — sales-assisted, negotiated pricing, not a fixed number.
          </p>
          <button disabled className="cursor-not-allowed rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white">
            Talk to us
          </button>
        </div>

        {/* settlement note */}
        <div className="mt-10 flex gap-4 rounded-2xl bg-teal-deep p-6 text-ivory">
          <div className="flex-none text-xl">ⓘ</div>
          <div>
            <h4 className="mb-1 text-[15.5px] font-semibold text-white">
              Every real cost is deducted automatically — you never see a surprise bill{' '}
              <span className="ml-1 rounded bg-gold-soft px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase text-[#5C4415]">
                Proposed
              </span>
            </h4>
            <p className="text-[13.3px] text-[#CFE3DD]">
              Commission, payment processing, and delivery costs (where applicable) come out of your earnings the moment
              your order settles — about a week after delivery, batched every Saturday. Nothing is ever added to what
              your buyer pays.
            </p>
          </div>
        </div>

        <footer className="mt-9 text-center text-xs text-ink-soft">
          WE Bohra Seller Portal — Pricing · temporary stakeholder preview, 2026-09-05 · features tagged &quot;Proposed&quot;
          are not live yet
        </footer>
      </div>
    </div>
  );
}
