'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { Skeleton } from '@/components/skeleton';

type SellerType = 'product' | 'service';
type ContactMode = 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay';

type Plan = {
  id: number;
  sellerType: SellerType;
  name: string;
  monthlyPrice: string;
  maxActiveListings: number | null;
  allowsPickupAndPay: boolean;
  pickupOfficeOption: boolean;
  allowsDelhivery: boolean;
  prioritySupport: boolean;
  remindersEnabled: boolean;
  contactMode: ContactMode | null;
  bonusOtherCategoryListings: number;
};

type Subscription = { sellerType: SellerType; planId: number | null; plan: Plan | null };

const CONTACT_MODE_LABEL: Record<ContactMode, string> = {
  whatsapp_number: 'WhatsApp number shown',
  direct_whatsapp: 'Direct WhatsApp contact',
  masked_relay: 'Masked — no number exposed',
};

/**
 * /seller/subscription — Phase 4 of the Fulfillment & Subscriptions
 * redesign: where she actually picks a plan. Every existing seller was
 * grandfathered onto a real plan before publish-gate enforcement went
 * live (see scripts/grandfather-subscriptions.ts), so landing here with
 * no plan at all only happens for a genuinely new seller. Recharge isn't
 * offered yet — it needs the real wallet top-up Phase 5 adds; picking it
 * now would just leave her stuck at ₹0.
 */
export default function SellerSubscriptionPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [choosingId, setChoosingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [plansRes, subsRes] = await Promise.all([
      fetch('/api/subscription-plans'),
      authFetch('/api/sellers/subscriptions'),
    ]);
    const plansData = await plansRes.json();
    const subsData = await subsRes.json();
    setPlans(plansData.plans ?? []);
    setSubscriptions(subsData.subscriptions ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function choose(sellerType: SellerType, planId: number) {
    setChoosingId(planId);
    setError(null);
    try {
      const res = await authFetch('/api/sellers/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerType, planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save your plan.');
        return;
      }
      load();
    } finally {
      setChoosingId(null);
    }
  }

  const productPlans = plans?.filter((p) => p.sellerType === 'product') ?? [];
  const servicePlans = plans?.filter((p) => p.sellerType === 'service') ?? [];
  const currentFor = (sellerType: SellerType) => subscriptions.find((s) => s.sellerType === sellerType)?.plan ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Subscription</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Your plan decides what you can publish — how many listings, Pickup &amp; Pay, and more.
          You need one for each kind of thing you sell.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">{error}</p>
      )}

      {plans === null ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          {productPlans.length > 0 && (
            <PlanSection
              title="Product plans"
              plans={productPlans}
              current={currentFor('product')}
              choosingId={choosingId}
              onChoose={(planId) => choose('product', planId)}
            />
          )}
          {servicePlans.length > 0 && (
            <PlanSection
              title="Service plans"
              plans={servicePlans}
              current={currentFor('service')}
              choosingId={choosingId}
              onChoose={(planId) => choose('service', planId)}
            />
          )}
        </>
      )}
    </div>
  );
}

function PlanSection({
  title,
  plans,
  current,
  choosingId,
  onChoose,
}: {
  title: string;
  plans: Plan[];
  current: Plan | null;
  choosingId: number | null;
  onChoose: (planId: number) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = current?.id === plan.id;
          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ${
                isCurrent ? 'ring-2 ring-teal' : 'ring-ink-soft/5'
              }`}
            >
              <div>
                <p className="font-heading text-base font-semibold text-ink">{plan.name}</p>
                <p className="font-body text-lg font-semibold text-navy">
                  ₹{Number(plan.monthlyPrice).toLocaleString('en-IN')}
                  <span className="font-body text-xs font-normal text-ink-soft">/mo</span>
                </p>
              </div>
              <ul className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                <li>{plan.maxActiveListings ? `Up to ${plan.maxActiveListings} listings` : 'Unlimited listings'}</li>
                {plan.allowsPickupAndPay && (
                  <li>Pickup &amp; Pay{plan.pickupOfficeOption ? ' (self + office)' : ' (self only)'}</li>
                )}
                {plan.allowsDelhivery && <li>Delhivery shipping</li>}
                {plan.contactMode && <li>{CONTACT_MODE_LABEL[plan.contactMode]}</li>}
                {plan.prioritySupport && <li>Priority support</li>}
                {plan.remindersEnabled && <li>Reminders</li>}
                {plan.bonusOtherCategoryListings > 0 && (
                  <li>
                    +{plan.bonusOtherCategoryListings} bonus listing{plan.bonusOtherCategoryListings > 1 ? 's' : ''} (other type)
                  </li>
                )}
              </ul>
              {isCurrent ? (
                <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal/10 px-3 py-2 font-body text-xs font-semibold text-teal-deep">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Current plan
                </span>
              ) : (
                <button
                  disabled={choosingId === plan.id}
                  onClick={() => onChoose(plan.id)}
                  className={buttonStyles('secondary', 'sm', 'mt-auto')}
                >
                  {choosingId === plan.id ? 'Saving…' : current ? 'Switch to this plan' : 'Choose this plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {plans.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Layers className="h-7 w-7 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No plans available right now.</p>
        </div>
      )}
    </section>
  );
}
