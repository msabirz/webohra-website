'use client';

import { useEffect, useState, FormEvent } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Store, User as UserIcon, MapPin, Truck } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { useSellerPortal } from '@/lib/seller-context';

type Jamaat = { id: number; city: string; name: string };

export default function SellerSettingsPage() {
  const { me, refresh } = useSellerPortal();

  // Account fields
  const [name, setName] = useState(me.user.name ?? '');
  const [email, setEmail] = useState(me.user.email ?? '');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Business fields
  const [businessName, setBusinessName] = useState(me.sellerProfile.businessName);
  const [plansDelhivery, setPlansDelhivery] = useState(!!me.sellerProfile.jamaatId);
  const [jamaatId, setJamaatId] = useState(me.sellerProfile.jamaatId ? String(me.sellerProfile.jamaatId) : '');
  const [jamaats, setJamaats] = useState<Jamaat[]>([]);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessSaved, setBusinessSaved] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Address — Fulfillment & Subscriptions redesign, Phase 2. Needed as the
  // origin for self-managed shipping and Pickup & Pay from her own address;
  // didn't exist before this.
  const [addressLine1, setAddressLine1] = useState(me.sellerProfile.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(me.sellerProfile.addressLine2 ?? '');
  const [addrCity, setAddrCity] = useState(me.sellerProfile.city ?? '');
  const [addrState, setAddrState] = useState(me.sellerProfile.state ?? '');
  const [addrPincode, setAddrPincode] = useState(me.sellerProfile.pincode ?? '');

  // Self-ship city (planning doc Decision 2) — one for now.
  const [shipCity, setShipCity] = useState(me.sellerShipCity ?? '');
  const [shipCitySaving, setShipCitySaving] = useState(false);
  const [shipCitySaved, setShipCitySaved] = useState(false);
  const [shipCityError, setShipCityError] = useState<string | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (plansDelhivery && jamaats.length === 0) {
      fetch('/api/jamaats')
        .then((res) => res.json())
        .then((data) => setJamaats(data.jamaats ?? []));
    }
  }, [plansDelhivery, jamaats.length]);

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    setAccountSaving(true);
    setAccountError(null);
    setAccountSaved(false);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAccountError(data.error ?? 'Could not save.');
        return;
      }
      window.dispatchEvent(new Event('wb:auth-changed'));
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 2000);
    } finally {
      setAccountSaving(false);
    }
  }

  async function saveBusiness(event: FormEvent) {
    event.preventDefault();
    setBusinessSaving(true);
    setBusinessError(null);
    setBusinessSaved(false);
    try {
      const res = await authFetch('/api/sellers/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          plansDelhiveryShipping: plansDelhivery,
          jamaatId: plansDelhivery && jamaatId ? Number(jamaatId) : undefined,
          addressLine1: addressLine1 || undefined,
          addressLine2,
          city: addrCity || undefined,
          state: addrState || undefined,
          pincode: addrPincode || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setBusinessError(data.error ?? 'Could not save.');
        return;
      }
      refresh();
      setBusinessSaved(true);
      setTimeout(() => setBusinessSaved(false), 2000);
    } finally {
      setBusinessSaving(false);
    }
  }

  async function saveShipCity(event: FormEvent) {
    event.preventDefault();
    setShipCitySaving(true);
    setShipCityError(null);
    setShipCitySaved(false);
    try {
      const res = await authFetch('/api/sellers/ship-city', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: shipCity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShipCityError(data.issues?.city?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      setShipCitySaved(true);
      setTimeout(() => setShipCitySaved(false), 2000);
    } finally {
      setShipCitySaving(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      const res = await authFetch('/api/auth/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.issues?.password?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      setNewPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Manage your account, business details, and password.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        {me.user.itsVerified ? (
          <ShieldCheck className="h-8 w-8 shrink-0 text-teal" strokeWidth={1.75} />
        ) : (
          <ShieldAlert className="h-8 w-8 shrink-0 text-gold" strokeWidth={1.75} />
        )}
        <div>
          <p className="font-body text-sm font-semibold text-ink">
            {me.user.itsVerified ? 'ITS verified' : 'Verification pending'}
          </p>
          <p className="font-body text-xs text-ink-soft">
            ITS ID {me.user.itsId ?? '—'} ·{' '}
            {me.user.itsVerified
              ? 'Verified by the Idara team.'
              : 'Reviewed by the Idara team before your products can go live.'}
          </p>
        </div>
      </div>

      <form onSubmit={saveBusiness} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Store className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Business details
        </h2>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Business name</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputStyles} />
        </div>
        <label className="flex items-center gap-2 font-body text-sm text-ink">
          <input
            type="checkbox"
            checked={plansDelhivery}
            onChange={(e) => setPlansDelhivery(e.target.checked)}
            className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
          />
          I ship via Delhivery for at least one product
        </label>
        {plansDelhivery && (
          <select value={jamaatId} onChange={(e) => setJamaatId(e.target.value)} className={inputStyles}>
            <option value="" disabled>
              Select your nearest jamaat
            </option>
            {jamaats.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} — {j.city}
              </option>
            ))}
          </select>
        )}
        <div className="mt-1 flex flex-col gap-3 border-t border-ink-soft/10 pt-4">
          <p className="flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
            Your address
          </p>
          <p className="-mt-2 font-body text-xs text-ink-soft">
            Used as the pickup point for self-managed shipping and Pickup &amp; Pay, when you choose
            your own address instead of a WeBohra office. Kept private by default — only shared with
            a buyer once you&apos;re ready, or if you choose to show it on a specific listing.
          </p>
          <input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Address line 1"
            className={inputStyles}
          />
          <input
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Address line 2 (optional)"
            className={inputStyles}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="City" className={inputStyles} />
            <input value={addrState} onChange={(e) => setAddrState(e.target.value)} placeholder="State" className={inputStyles} />
          </div>
          <input
            value={addrPincode}
            onChange={(e) => setAddrPincode(e.target.value)}
            placeholder="Pincode"
            className={`${inputStyles} max-w-[160px]`}
          />
        </div>
        {businessError && <p className="font-body text-sm text-red-700">{businessError}</p>}
        <button type="submit" disabled={businessSaving} className={buttonStyles('primary', 'md')}>
          {businessSaving ? 'Saving…' : businessSaved ? 'Saved ✓' : 'Save business details'}
        </button>
      </form>

      <form onSubmit={saveShipCity} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Truck className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Self-ship city
        </h2>
        <p className="-mt-2 font-body text-xs text-ink-soft">
          Which city you deliver yourself to. Buyers outside it won&apos;t be able to choose
          self-managed shipping on your listings — one city for now.
        </p>
        <input
          value={shipCity}
          onChange={(e) => setShipCity(e.target.value)}
          placeholder="e.g. Mumbai"
          className={`${inputStyles} max-w-xs`}
        />
        {shipCityError && <p className="font-body text-sm text-red-700">{shipCityError}</p>}
        <button type="submit" disabled={shipCitySaving} className={buttonStyles('secondary', 'md')}>
          {shipCitySaving ? 'Saving…' : shipCitySaved ? 'Saved ✓' : 'Save self-ship city'}
        </button>
      </form>

      <form onSubmit={saveAccount} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <UserIcon className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Your account
        </h2>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyles} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Phone number</label>
          <input value={me.user.phone} disabled className={`${inputStyles} bg-ivory-deep text-ink-soft`} />
        </div>
        {accountError && <p className="font-body text-sm text-red-700">{accountError}</p>}
        <button type="submit" disabled={accountSaving} className={buttonStyles('secondary', 'md')}>
          {accountSaving ? 'Saving…' : accountSaved ? 'Saved ✓' : 'Save account details'}
        </button>
      </form>

      <form onSubmit={changePassword} className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Password
        </h2>
        <p className="font-body text-xs text-ink-soft">
          Forgot your current password?{' '}
          <a href="/seller/login" className="font-medium text-navy hover:underline">
            Sign out and use &quot;Forgot password?&quot;
          </a>{' '}
          instead.
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          minLength={8}
          className={inputStyles}
        />
        {passwordError && <p className="font-body text-sm text-red-700">{passwordError}</p>}
        <button
          type="submit"
          disabled={passwordSaving || newPassword.length === 0}
          className={buttonStyles('secondary', 'md')}
        >
          {passwordSaving ? 'Saving…' : passwordSaved ? 'Saved ✓' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
