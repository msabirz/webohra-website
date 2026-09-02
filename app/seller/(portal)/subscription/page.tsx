'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Layers, Wallet } from 'lucide-react';
import Link from 'next/link';
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

type Subscription = { sellerType: SellerType; billingMode: 'plan' | 'recharge'; planId: number | null; plan: Plan | null };

const CONTACT_MODE_LABEL: Record<ContactMode, string> = {
  whatsapp_number: 'WhatsApp number shown',
  direct_whatsapp: 'Direct WhatsApp contact',
  masked_relay: 'Masked — no number exposed',
};

/**
 * /seller/subscription — a flat monthly plan, or pay-as-you-go from her
 * wallet (Fulfillment & Subscriptions redesign, Phase 5), for each kind of
 * thing she sells. Every existing seller was grandfathered onto a real
 * plan before publish-gate enforcement went live (see
 * scripts/grandfather-subscriptions.ts), so landing here with no
 * subscription at all only happens for a genuinely new seller. Recharge
 * only shows up per section when Admin has actually configured a matching
 * default plan for that seller_type (see /api/subscription-plans'
 * rechargeDefaultPlanId) — same "never offer a choice that would leave her
 * stuck" reasoning that used to keep recharge hidden entirely before this
 * phase.
 */
export default function SellerSubscriptionPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [rechargeDefaultPlanId, setRechargeDefaultPlanId] = useState<number | null>(null);
  const [walletMinThreshold, setWalletMinThreshold] = useState('0');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [choosingId, setChoosingId] = useState<number | 'recharge-product' | 'recharge-service' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [plansRes, subsRes] = await Promise.all([
      fetch('/api/subscription-plans'),
      authFetch('/api/sellers/subscriptions'),
    ]);
    const plansData = await plansRes.json();
    const subsData = await subsRes.json();
    setPlans(plansData.plans ?? []);
    setRechargeDefaultPlanId(plansData.rechargeDefaultPlanId ?? null);
    setWalletMinThreshold(plansData.walletMinThreshold ?? '0');
    setSubscriptions(subsData.subscriptions ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function choosePlan(sellerType: SellerType, planId: number) {
    setChoosingId(planId);
    setError(null);
    try {
      const res = await authFetch('/api/sellers/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerType, billingMode: 'plan', planId }),
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

  async function chooseRecharge(sellerType: SellerType) {
    const key = sellerType === 'product' ? 'recharge-product' : 'recharge-service';
    setChoosingId(key);
    setError(null);
    try {
      const res = await authFetch('/api/sellers/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerType, billingMode: 'recharge' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not switch to pay-as-you-go.');
        return;
      }
      load();
    } finally {
      setChoosingId(null);
    }
  }

  const productPlans = plans?.filter((p) => p.sellerType === 'product') ?? [];
  const servicePlans = plans?.filter((p) => p.sellerType === 'service') ?? [];
  const rechargePlan = plans?.find((p) => p.id === rechargeDefaultPlanId) ?? null;
  const subscriptionFor = (sellerType: SellerType) => subscriptions.find((s) => s.sellerType === sellerType) ?? null;

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
              subscription={subscriptionFor('product')}
              rechargePlan={rechargePlan?.sellerType === 'product' ? rechargePlan : null}
              walletMinThreshold={walletMinThreshold}
              choosingId={choosingId}
              onChoosePlan={(planId) => choosePlan('product', planId)}
              onChooseRecharge={() => chooseRecharge('product')}
              rechargeKey="recharge-product"
            />
          )}
          {servicePlans.length > 0 && (
            <PlanSection
              title="Service plans"
              plans={servicePlans}
              subscription={subscriptionFor('service')}
              rechargePlan={rechargePlan?.sellerType === 'service' ? rechargePlan : null}
              walletMinThreshold={walletMinThreshold}
              choosingId={choosingId}
              onChoosePlan={(planId) => choosePlan('service', planId)}
              onChooseRecharge={() => chooseRecharge('service')}
              rechargeKey="recharge-service"
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
  subscription,
  rechargePlan,
  walletMinThreshold,
  choosingId,
  onChoosePlan,
  onChooseRecharge,
  rechargeKey,
}: {
  title: string;
  plans: Plan[];
  subscription: Subscription | null;
  rechargePlan: Plan | null;
  walletMinThreshold: string;
  choosingId: number | 'recharge-product' | 'recharge-service' | null;
  onChoosePlan: (planId: number) => void;
  onChooseRecharge: () => void;
  rechargeKey: 'recharge-product' | 'recharge-service';
}) {
  const currentPlan = subscription?.billingMode === 'plan' ? subscription.plan : null;
  const isOnRecharge = subscription?.billingMode === 'recharge';
  const hasAnySubscription = subscription !== null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
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
              <PlanFeatureList plan={plan} />
              {isCurrent ? (
                <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal/10 px-3 py-2 font-body text-xs font-semibold text-teal-deep">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Current plan
                </span>
              ) : (
                <button
                  disabled={choosingId === plan.id}
                  onClick={() => onChoosePlan(plan.id)}
                  className={buttonStyles('secondary', 'sm', 'mt-auto')}
                >
                  {choosingId === plan.id ? 'Saving…' : hasAnySubscription ? 'Switch to this plan' : 'Choose this plan'}
                </button>
              )}
            </div>
          );
        })}

        {rechargePlan && (
          <div
            className={`flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ${
              isOnRecharge ? 'ring-2 ring-teal' : 'ring-ink-soft/5'
            }`}
          >
            <div>
              <p className="font-heading text-base font-semibold text-ink">Pay as you go</p>
              <p className="font-body text-lg font-semibold text-navy">
                From your wallet
                <span className="font-body text-xs font-normal text-ink-soft"> · no monthly fee</span>
              </p>
            </div>
            <PlanFeatureList plan={rechargePlan} />
            <p className="font-body text-xs text-ink-soft">
              Listings show as Out of Stock below a ₹{Number(walletMinThreshold).toLocaleString('en-IN')} balance —
              top up any time from your Wallet.
            </p>
            {isOnRecharge ? (
              <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal/10 px-3 py-2 font-body text-xs font-semibold text-teal-deep">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Current — pay as you go
              </span>
            ) : (
              <button
                disabled={choosingId === rechargeKey}
                onClick={onChooseRecharge}
                className={buttonStyles('secondary', 'sm', 'mt-auto')}
              >
                {choosingId === rechargeKey ? 'Saving…' : 'Switch to pay as you go'}
              </button>
            )}
            {isOnRecharge && (
              <Link
                href="/seller/wallet"
                className="mt-1 inline-flex items-center justify-center gap-1.5 font-body text-xs font-semibold text-navy underline underline-offset-2"
              >
                <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
                Top up wallet
              </Link>
            )}
          </div>
        )}
      </div>
      {plans.length === 0 && !rechargePlan && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Layers className="h-7 w-7 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No plans available right now.</p>
        </div>
      )}
    </section>
  );
}

function PlanFeatureList({ plan }: { plan: Plan }) {
  return (
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
  );
}
