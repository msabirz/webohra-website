'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, MapPinned, Wallet, Check, Store, ShoppingBag, LogIn } from 'lucide-react';
import { useCart } from '@/components/cart-context';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';
import { authFetch, getAuthToken } from '@/lib/session-client';
import { resolveCartLine, computeShipmentGroups, type CartListingSnapshot } from '@/lib/cart-line';
import { loadRazorpayScript } from '@/lib/razorpay-client';

type ListingSnapshot = CartListingSnapshot;

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
  // Fulfillment & Subscriptions redesign, Phase 5b.
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  // Only a nudge — checked once on mount (not reactive to a login that
  // happens in another tab) since this is a low-stakes UI hint, not a
  // gate: guest checkout is fully supported (2026-09-04, user's own ask —
  // "please login if you don't want to continue as guest").
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    setIsGuest(!getAuthToken());
  }, []);

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
    const { price } = resolveCartLine(listings[item.listingId], item);
    return price !== null ? sum + price * item.quantity : sum;
  }, 0);

  const shipmentGroups = useMemo(() => computeShipmentGroups(items, listings), [items, listings]);
  const shippingTotal = shipmentGroups.reduce((sum, g) => sum + g.charge, 0);
  const total = subtotal + shippingTotal;

  // Online payment charges the full cart total in one combined Razorpay
  // payment, any number of sellers included — see app/api/orders/route.ts's
  // own comment on why this no longer needs a single-seller cart (that
  // restriction depended on Razorpay Route, never enabled on this account,
  // and payout-splitting has never actually needed it). Still requires
  // every line's listing to have actually loaded first — while any is
  // still loading, this stays false rather than guessing.
  const allListingsLoaded = items.every((item) => listings[item.listingId] !== undefined);
  const onlinePaymentEligible = items.length > 0 && allListingsLoaded;

  useEffect(() => {
    if (!onlinePaymentEligible && paymentMethod === 'online') setPaymentMethod('cod');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlinePaymentEligible]);

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
        body: JSON.stringify({
          ...form,
          paymentMethod,
          // The cart stores variantId: null for a simple listing (see
          // CartItem's own comment) but the API's schema only accepts a
          // real number or an omitted key, not literal null — dropped here
          // rather than loosening the schema just for this one caller.
          items: items.map((i) => ({
            listingId: i.listingId,
            quantity: i.quantity,
            ...(i.variantId !== null && { variantId: i.variantId }),
          })),
        }),
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
        setSubmitting(false);
        return;
      }

      // The cart's job is done the instant a real order exists server-side —
      // same for COD and online, exactly as before this change. An online
      // order still needing payment is tracked on the order record itself
      // (paymentStatus: 'pending'), not the cart.
      clear();

      if (paymentMethod === 'online' && data.razorpay) {
        // Opens the SAME widget the order page used to require a second
        // click to reach — every path out of this (success, she closes it,
        // the script fails to load) ends in a redirect, so `submitting`
        // never needs resetting here; the page is on its way out either way.
        await openRazorpayCheckout(data.order.orderNumber, data.razorpay);
        return;
      }

      router.push(`/order/${data.order.orderNumber}`);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  async function openRazorpayCheckout(
    orderNumber: string,
    razorpay: { razorpayOrderId: string; amount: number; currency: string; keyId: string },
  ) {
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) {
        // The order already exists — her own order page can still retry
        // from here, same fallback as every other path out of this widget.
        router.push(`/order/${orderNumber}`);
        return;
      }
      const rzp = new window.Razorpay({
        key: razorpay.keyId,
        amount: razorpay.amount,
        currency: razorpay.currency,
        order_id: razorpay.razorpayOrderId,
        name: 'WE Bohra',
        description: `Order ${orderNumber}`,
        prefill: { name: form.buyerName, contact: form.buyerPhone, email: form.buyerEmail || undefined },
        theme: { color: '#1B3A6B' },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Verify, then let the order page itself be the single source of
          // truth for what actually happened (it re-fetches fresh) — a
          // failed verify call here still lands her somewhere real and
          // retryable, never a dead end on the checkout page itself.
          await fetch(`/api/orders/${orderNumber}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).catch(() => {});
          router.push(`/order/${orderNumber}`);
        },
        modal: {
          // She closed the widget without completing payment. Nothing is
          // lost — the order already exists in 'pending', so her own order
          // page picks up right where this left off: the amber "complete
          // your payment" banner with the exact same retry button. If
          // Razorpay's webhook later marks a genuine failed attempt, that
          // same page shows the dedicated "Payment failed" state instead.
          ondismiss: () => {
            router.push(`/order/${orderNumber}`);
          },
        },
      });
      rzp.open();
    } catch {
      router.push(`/order/${orderNumber}`);
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

        {isGuest && (
          <div className="flex items-center gap-3 rounded-2xl bg-navy/5 px-4 py-3 ring-1 ring-navy/10">
            <LogIn className="h-4 w-4 shrink-0 text-navy" strokeWidth={2} />
            <p className="flex-1 font-body text-xs text-ink-soft">
              <span className="font-semibold text-ink">Have an account?</span> Log in to track this
              order and skip re-entering your details next time — or just continue below as a
              guest.
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent('/checkout')}`}
              className="shrink-0 font-body text-xs font-semibold text-navy underline hover:text-navy-deep"
            >
              Log in
            </Link>
          </div>
        )}

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
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 font-body text-sm transition ${
              paymentMethod === 'cod' ? 'border-navy bg-navy/5 text-ink' : 'border-ink-soft/15 text-ink-soft'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              className="sr-only"
              checked={paymentMethod === 'cod'}
              onChange={() => setPaymentMethod('cod')}
            />
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full ${
                paymentMethod === 'cod' ? 'bg-navy' : 'border-2 border-ink-soft/30'
              }`}
            >
              {paymentMethod === 'cod' && <Check className="h-2.5 w-2.5 text-ivory" strokeWidth={3} />}
            </span>
            Cash on Delivery
          </label>
          <label
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-body text-sm transition ${
              !onlinePaymentEligible
                ? 'cursor-not-allowed border-ink-soft/15 bg-ivory-deep text-ink-soft opacity-60'
                : paymentMethod === 'online'
                  ? 'cursor-pointer border-navy bg-navy/5 text-ink'
                  : 'cursor-pointer border-ink-soft/15 text-ink-soft'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              className="sr-only"
              disabled={!onlinePaymentEligible}
              checked={paymentMethod === 'online'}
              onChange={() => setPaymentMethod('online')}
            />
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full ${
                paymentMethod === 'online' ? 'bg-navy' : 'border-2 border-ink-soft/30'
              }`}
            >
              {paymentMethod === 'online' && <Check className="h-2.5 w-2.5 text-ivory" strokeWidth={3} />}
            </span>
            Pay Online (Razorpay)
          </label>
        </FormSection>

        {error && <p className="font-body text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'lg')}>
          {submitting
            ? paymentMethod === 'online'
              ? 'Opening payment…'
              : 'Placing order…'
            : paymentMethod === 'online'
              ? `Pay ₹${total.toLocaleString('en-IN')} now`
              : `Place order · ₹${total.toLocaleString('en-IN')}`}
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
                const { price, variantName } = resolveCartLine(listing, item);
                return (
                  <li
                    key={`${item.listingId}-${item.variantId ?? 'simple'}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <p className="font-body text-ink">
                      {listing?.title ?? `Collection #${item.listingId}`}
                      {variantName && ` — ${variantName}`} × {item.quantity}
                    </p>
                    {price !== null && (
                      <p className="font-body font-medium text-ink">
                        ₹{(price * item.quantity).toLocaleString('en-IN')}
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
          {shipmentGroups.length > 0 ? (
            shipmentGroups.map((g) => (
              <div key={`${g.sellerId}-${g.method}`} className="flex items-center justify-between text-ink-soft">
                <span>
                  Shipping{shipmentGroups.length > 1 && g.businessName ? ` — ${g.businessName}` : ''}
                  {g.method === 'delhivery' ? ' (Delhivery)' : ''}
                </span>
                <span>{g.charge > 0 ? `₹${g.charge.toLocaleString('en-IN')}` : 'Free'}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between text-ink-soft">
              <span>Shipping</span>
              <span>Free</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-ink-soft/15 pt-1.5 font-semibold">
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
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
  // Derived from the label rather than threaded through as its own prop at
  // every call site — every label used here is already unique on this page.
  const id = `checkout-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-body text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
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
