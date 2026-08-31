'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, MapPinned, Wallet, Check, Store, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/cart-context';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';
import { authFetch } from '@/lib/session-client';

type ListingSnapshot = {
  id: number;
  title: string;
  price: string;
  businessName: string | null;
};

type FormState = {
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
};

const initialForm: FormState = {
  buyerName: '',
  buyerPhone: '',
  buyerEmail: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCart();
  const [listings, setListings] = useState<Record<number, ListingSnapshot>>({});
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const ids = useMemo(() => items.map((i) => i.listingId), [items]);

  useEffect(() => {
    if (ids.length === 0) return;
    Promise.all(
      ids.map((id) =>
        fetch(`/api/listings/${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => data?.listing as ListingSnapshot | undefined),
      ),
    ).then((results) => {
      const map: Record<number, ListingSnapshot> = {};
      for (const listing of results) if (listing) map[listing.id] = listing;
      setListings(map);
    });
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const bySeller = new Map<string, typeof items>();
    for (const item of items) {
      const key = listings[item.listingId]?.businessName ?? 'Seller';
      bySeller.set(key, [...(bySeller.get(key) ?? []), item]);
    }
    return Array.from(bySeller.entries());
  }, [items, listings]);

  const subtotal = items.reduce((sum, item) => {
    const listing = listings[item.listingId];
    return listing ? sum + Number(listing.price) * item.quantity : sum;
  }, 0);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      // authFetch (not plain fetch) so a signed-in buyer's order links to her
      // account — see userId on orders in db/schema.ts — while still working
      // for a guest with no token at all (FR-5b allows guest checkout).
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, paymentMethod: 'cod', items }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          const errs: Record<string, string> = {};
          for (const key of Object.keys(data.issues)) errs[key] = data.issues[key]?.[0];
          setFieldErrors(errs);
        } else {
          setError(data.error ?? 'Something went wrong. Please try again.');
        }
        return;
      }
      clear();
      router.push(`/order/${data.order.orderNumber}`);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory-deep">
          <ShoppingBag className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
        </span>
        <p className="font-heading text-xl font-semibold text-ink">Your cart is empty</p>
        <Link href="/" className={buttonStyles('primary', 'md')}>
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 md:order-1" noValidate>
        <h1 className="font-heading text-2xl font-semibold text-ink">Checkout</h1>

        <FormSection icon={User} title="Contact info">
          <TextField
            label="Full name"
            value={form.buyerName}
            onChange={(v) => update('buyerName', v)}
            error={fieldErrors.buyerName}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkout-phone" className="font-body text-sm font-medium text-ink">
              Phone number
            </label>
            <PhoneInput
              id="checkout-phone"
              value={form.buyerPhone}
              onChange={(v) => update('buyerPhone', v)}
              required
            />
            {fieldErrors.buyerPhone && (
              <p className="font-body text-xs text-red-700">{fieldErrors.buyerPhone}</p>
            )}
          </div>
          <TextField
            label="Email (optional)"
            value={form.buyerEmail}
            onChange={(v) => update('buyerEmail', v)}
            error={fieldErrors.buyerEmail}
            type="email"
          />
        </FormSection>

        <FormSection icon={MapPinned} title="Shipping address">
          <TextField
            label="Address line 1"
            value={form.addressLine1}
            onChange={(v) => update('addressLine1', v)}
            error={fieldErrors.addressLine1}
            required
          />
          <TextField
            label="Address line 2 (optional)"
            value={form.addressLine2}
            onChange={(v) => update('addressLine2', v)}
            error={fieldErrors.addressLine2}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="City"
              value={form.city}
              onChange={(v) => update('city', v)}
              error={fieldErrors.city}
              required
            />
            <TextField
              label="State"
              value={form.state}
              onChange={(v) => update('state', v)}
              error={fieldErrors.state}
              required
            />
          </div>
          <TextField
            label="Pincode"
            value={form.pincode}
            onChange={(v) => update('pincode', v.replace(/\D/g, '').slice(0, 6))}
            error={fieldErrors.pincode}
            inputMode="numeric"
            required
          />
        </FormSection>

        <FormSection icon={Wallet} title="Payment">
          <label className="flex items-center gap-3 rounded-xl border border-navy bg-navy/5 px-4 py-3 font-body text-sm text-ink">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-navy">
              <Check className="h-2.5 w-2.5 text-ivory" strokeWidth={3} />
            </span>
            Cash on Delivery
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-ink-soft/15 bg-ivory-deep px-4 py-3 font-body text-sm text-ink-soft opacity-60">
            <span className="h-4 w-4 rounded-full border-2 border-ink-soft/30" />
            Pay Online — coming soon
          </label>
        </FormSection>

        {error && <p className="font-body text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'lg')}>
          {submitting ? 'Placing order…' : `Place order · ₹${subtotal.toLocaleString('en-IN')}`}
        </button>
      </form>

      <div className="flex flex-col gap-4 self-start md:order-2">
        <h2 className="font-heading text-lg font-semibold text-ink">Order summary</h2>
        {grouped.map(([sellerName, sellerItems]) => (
          <div
            key={sellerName}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5"
          >
            <p className="mb-3 flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <Store className="h-3.5 w-3.5" strokeWidth={2} />
              {sellerName}
            </p>
            <ul className="flex flex-col gap-2">
              {sellerItems.map((item) => {
                const listing = listings[item.listingId];
                return (
                  <li
                    key={item.listingId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <p className="font-body text-ink">
                      {listing?.title ?? `Collection #${item.listingId}`} × {item.quantity}
                    </p>
                    {listing && (
                      <p className="font-body font-medium text-ink">
                        ₹{(Number(listing.price) * item.quantity).toLocaleString('en-IN')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="flex flex-col gap-1.5 rounded-2xl bg-ivory-deep px-5 py-4 font-body text-sm text-ink">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between text-ink-soft">
            <span>Shipping</span>
            <span>Calculated by seller</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-ink-soft/15 pt-1.5 font-semibold">
            <span>Total</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-ink-soft" strokeWidth={2} />
        {title}
      </h2>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  required,
  type = 'text',
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-sm font-medium text-ink">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={inputStyles}
      />
      {error && <p className="font-body text-xs text-red-700">{error}</p>}
    </div>
  );
}
