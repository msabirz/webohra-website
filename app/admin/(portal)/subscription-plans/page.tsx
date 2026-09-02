'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Layers, Plus, Archive, ArchiveRestore, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton } from '@/components/skeleton';

type SellerType = 'product' | 'service';
type ContactMode = 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay';

type Plan = {
  id: number;
  sellerType: SellerType;
  tierKey: string;
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
  active: boolean;
  sortOrder: number;
};

type Settings = {
  id: number;
  walletMinThreshold: string;
  rechargeDefaultPlanId: number | null;
  bonusListingCommissionPercent: string;
};

const CONTACT_MODE_LABEL: Record<ContactMode, string> = {
  whatsapp_number: 'WhatsApp number shown',
  direct_whatsapp: 'Direct WhatsApp contact',
  masked_relay: 'Masked — no number exposed',
};

/**
 * /admin/subscription-plans — Phase 1 of the Fulfillment & Subscriptions
 * redesign (see the planning artifact): every gate here is a plain,
 * admin-edited field on a subscription_plans row, not logic keyed off a
 * tier name in code, so adding a new tier or changing what one includes
 * never needs a deploy. Nothing on this page is enforced anywhere else in
 * the app yet — that's later phases (seller onboarding, checkout gating).
 */
export default function AdminSubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [createFor, setCreateFor] = useState<SellerType | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

  async function load() {
    const [plansRes, settingsRes] = await Promise.all([
      authFetch('/api/admin/subscription-plans'),
      authFetch('/api/admin/subscription-settings'),
    ]);
    const plansData = await plansRes.json();
    const settingsData = await settingsRes.json();
    setPlans(plansData.plans ?? []);
    setSettings(settingsData.settings ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(plan: Plan) {
    if (
      plan.active &&
      !confirm(`Archive "${plan.name}"? Sellers already on it keep working exactly as before — this only hides it from new sign-ups.`)
    ) {
      return;
    }
    await authFetch(`/api/admin/subscription-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !plan.active }),
    });
    load();
  }

  const productPlans = plans?.filter((p) => p.sellerType === 'product') ?? [];
  const servicePlans = plans?.filter((p) => p.sellerType === 'service') ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Subscription Plans</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Price and every feature gate, editable here — no deploy needed to add a tier or change what it includes.
        </p>
      </div>

      {settings && <SettingsCard settings={settings} plans={plans ?? []} onSaved={load} />}

      {plans === null ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <PlanSection
            title="Product sellers"
            sellerType="product"
            plans={productPlans}
            onAdd={() => setCreateFor('product')}
            onEdit={setEditing}
            onToggleActive={toggleActive}
          />
          <PlanSection
            title="Service sellers"
            sellerType="service"
            plans={servicePlans}
            onAdd={() => setCreateFor('service')}
            onEdit={setEditing}
            onToggleActive={toggleActive}
          />
        </>
      )}

      {createFor && (
        <PlanFormModal
          sellerType={createFor}
          plan={null}
          onClose={() => setCreateFor(null)}
          onDone={() => {
            setCreateFor(null);
            load();
          }}
        />
      )}
      {editing && (
        <PlanFormModal
          sellerType={editing.sellerType}
          plan={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PlanSection({
  title,
  sellerType,
  plans,
  onAdd,
  onEdit,
  onToggleActive,
}: {
  title: string;
  sellerType: SellerType;
  plans: Plan[];
  onAdd: () => void;
  onEdit: (plan: Plan) => void;
  onToggleActive: (plan: Plan) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
        <button onClick={onAdd} className={buttonStyles('accent', 'sm')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Layers className="h-7 w-7 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No {sellerType} plans yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-base font-semibold text-ink">{plan.name}</p>
                  <p className="font-body text-lg font-semibold text-navy">
                    ₹{Number(plan.monthlyPrice).toLocaleString('en-IN')}
                    <span className="font-body text-xs font-normal text-ink-soft">/mo</span>
                  </p>
                </div>
                {!plan.active && (
                  <span className="shrink-0 rounded-full bg-ink-soft/10 px-2 py-0.5 font-body text-[11px] text-ink-soft">Archived</span>
                )}
              </div>

              <ul className="flex flex-col gap-1 font-body text-xs text-ink-soft">
                <li>{plan.maxActiveListings ? `Up to ${plan.maxActiveListings} listings` : 'Unlimited listings'}</li>
                {sellerType === 'product' && (
                  <>
                    {plan.allowsPickupAndPay && <li>Pickup &amp; Pay{plan.pickupOfficeOption ? ' (self + office)' : ' (self only)'}</li>}
                    {plan.allowsDelhivery && <li>Delhivery shipping</li>}
                  </>
                )}
                {sellerType === 'service' && plan.contactMode && <li>{CONTACT_MODE_LABEL[plan.contactMode]}</li>}
                {plan.prioritySupport && <li>Priority support</li>}
                {plan.remindersEnabled && <li>Reminders</li>}
                {plan.bonusOtherCategoryListings > 0 && (
                  <li>+{plan.bonusOtherCategoryListings} bonus listing{plan.bonusOtherCategoryListings > 1 ? 's' : ''} (other type)</li>
                )}
              </ul>

              <div className="mt-auto flex gap-2 pt-1">
                <button onClick={() => onEdit(plan)} className={buttonStyles('secondary', 'sm', 'flex-1')}>
                  Edit
                </button>
                <button
                  onClick={() => onToggleActive(plan)}
                  className={buttonStyles('ghost', 'sm')}
                  aria-label={plan.active ? 'Archive plan' : 'Restore plan'}
                  title={plan.active ? 'Archive plan' : 'Restore plan'}
                >
                  {plan.active ? <Archive className="h-3.5 w-3.5" strokeWidth={2} /> : <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={2} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsCard({ settings, plans, onSaved }: { settings: Settings; plans: Plan[]; onSaved: () => void }) {
  const [walletMinThreshold, setWalletMinThreshold] = useState(settings.walletMinThreshold);
  const [rechargeDefaultPlanId, setRechargeDefaultPlanId] = useState(settings.rechargeDefaultPlanId ?? '');
  const [bonusListingCommissionPercent, setBonusListingCommissionPercent] = useState(settings.bonusListingCommissionPercent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await authFetch('/api/admin/subscription-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletMinThreshold: Number(walletMinThreshold),
          rechargeDefaultPlanId: rechargeDefaultPlanId ? Number(rechargeDefaultPlanId) : null,
          bonusListingCommissionPercent: Number(bonusListingCommissionPercent),
        }),
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-ivory-deep/60 p-5">
      <p className="mb-3 font-heading text-sm font-semibold text-ink">Global settings — recharge model</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">Min wallet balance (₹)</span>
          <input
            type="number"
            min={0}
            value={walletMinThreshold}
            onChange={(e) => setWalletMinThreshold(e.target.value)}
            className={inputStyles}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">Default plan for recharge sellers</span>
          <select
            value={rechargeDefaultPlanId}
            onChange={(e) => setRechargeDefaultPlanId(e.target.value)}
            className={inputStyles}
          >
            <option value="">Not set</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sellerType})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">Bonus-listing commission (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={bonusListingCommissionPercent}
            onChange={(e) => setBonusListingCommissionPercent(e.target.value)}
            className={inputStyles}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={saving} className={buttonStyles('primary', 'sm')}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="font-body text-xs text-teal-deep">Saved.</span>}
      </div>
    </div>
  );
}

function PlanFormModal({
  sellerType,
  plan,
  onClose,
  onDone,
}: {
  sellerType: SellerType;
  plan: Plan | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = !!plan;
  const [tierKey, setTierKey] = useState(plan?.tierKey ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [monthlyPrice, setMonthlyPrice] = useState(plan?.monthlyPrice ?? '');
  const [maxActiveListings, setMaxActiveListings] = useState(plan?.maxActiveListings?.toString() ?? '');
  const [allowsPickupAndPay, setAllowsPickupAndPay] = useState(plan?.allowsPickupAndPay ?? false);
  const [pickupOfficeOption, setPickupOfficeOption] = useState(plan?.pickupOfficeOption ?? false);
  const [allowsDelhivery, setAllowsDelhivery] = useState(plan?.allowsDelhivery ?? false);
  const [prioritySupport, setPrioritySupport] = useState(plan?.prioritySupport ?? false);
  const [remindersEnabled, setRemindersEnabled] = useState(plan?.remindersEnabled ?? false);
  const [contactMode, setContactMode] = useState<ContactMode | ''>(plan?.contactMode ?? '');
  const [bonusOtherCategoryListings, setBonusOtherCategoryListings] = useState(
    plan?.bonusOtherCategoryListings?.toString() ?? '0',
  );
  const [sortOrder, setSortOrder] = useState(plan?.sortOrder?.toString() ?? '0');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...(isEdit ? {} : { sellerType, tierKey: tierKey.trim().toLowerCase() }),
        name,
        monthlyPrice: Number(monthlyPrice),
        ...(maxActiveListings ? { maxActiveListings: Number(maxActiveListings) } : isEdit ? { maxActiveListings: null } : {}),
        allowsPickupAndPay,
        pickupOfficeOption,
        allowsDelhivery,
        prioritySupport,
        remindersEnabled,
        ...(sellerType === 'service' ? { contactMode: contactMode || null } : {}),
        bonusOtherCategoryListings: Number(bonusOtherCategoryListings),
        sortOrder: Number(sortOrder),
      };
      const res = await authFetch(
        isEdit ? `/api/admin/subscription-plans/${plan.id}` : '/api/admin/subscription-plans',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const firstIssue = data.issues ? Object.values(data.issues)[0] : null;
        setError((Array.isArray(firstIssue) ? firstIssue[0] : firstIssue) ?? data.error ?? 'Could not save.');
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <form
        onSubmit={handleSubmit}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">
            {isEdit ? `Edit ${plan.name}` : `New ${sellerType} plan`}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name (e.g. Gold)" required autoFocus className={inputStyles} />
        {!isEdit && (
          <input
            value={tierKey}
            onChange={(e) => setTierKey(e.target.value)}
            placeholder="Tier key (e.g. gold) — lowercase, no spaces"
            required
            className={inputStyles}
          />
        )}
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">Monthly price (₹)</span>
          <input type="number" min={0} step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} required className={inputStyles} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">Max active listings (blank = unlimited)</span>
          <input type="number" min={1} value={maxActiveListings} onChange={(e) => setMaxActiveListings(e.target.value)} className={inputStyles} />
        </label>

        <div className="flex flex-col gap-2 rounded-xl bg-ivory-deep/50 p-3">
          <TogglePill label="Priority support" checked={prioritySupport} onChange={setPrioritySupport} />
          <TogglePill label="Reminders" checked={remindersEnabled} onChange={setRemindersEnabled} />
          {sellerType === 'product' && (
            <>
              <TogglePill label="Pickup & Pay" checked={allowsPickupAndPay} onChange={setAllowsPickupAndPay} />
              <TogglePill
                label="Pickup from WeBohra office too (not just her address)"
                checked={pickupOfficeOption}
                onChange={setPickupOfficeOption}
                disabled={!allowsPickupAndPay}
              />
              <TogglePill label="Delhivery shipping" checked={allowsDelhivery} onChange={setAllowsDelhivery} />
            </>
          )}
        </div>

        {sellerType === 'service' && (
          <label className="flex flex-col gap-1">
            <span className="font-body text-xs font-medium text-ink-soft">Contact mode</span>
            <select value={contactMode} onChange={(e) => setContactMode(e.target.value as ContactMode | '')} className={inputStyles}>
              <option value="">Not set</option>
              <option value="whatsapp_number">WhatsApp number shown</option>
              <option value="direct_whatsapp">Direct WhatsApp contact</option>
              <option value="masked_relay">Masked — no number exposed</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">
            Free bonus listings in the other seller type
          </span>
          <input
            type="number"
            min={0}
            max={10}
            value={bonusOtherCategoryListings}
            onChange={(e) => setBonusOtherCategoryListings(e.target.value)}
            className={inputStyles}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-xs font-medium text-ink-soft">Sort order (lower shows first)</span>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputStyles} />
        </label>

        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create plan'}
        </button>
      </form>
    </div>
  );
}

function TogglePill({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left font-body text-xs font-medium transition disabled:opacity-40 ${
        checked ? 'bg-teal/10 text-teal-deep' : 'bg-white text-ink-soft ring-1 ring-ink-soft/10'
      }`}
    >
      {label}
      <span className={`h-4 w-7 shrink-0 rounded-full transition ${checked ? 'bg-teal-deep' : 'bg-ink-soft/20'}`}>
        <span className={`block h-3.5 w-3.5 translate-y-px rounded-full bg-white shadow transition ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}
