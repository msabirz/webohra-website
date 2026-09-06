'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Package, LogOut, KeyRound, MessageCircle, MapPin, Plus, Star, Trash2, Pencil, Heart } from 'lucide-react';
import { authFetch, clearAuthToken, getAuthToken } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton, RowListSkeleton } from '@/components/skeleton';

type OrderSummary = {
  orderNumber: string;
  status: 'placed' | 'cancelled';
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'paid' | 'failed' | null;
  createdAt: string;
  itemCount: number;
  total: number;
};

const STATUS_LABEL: Record<OrderSummary['status'], string> = {
  placed: 'Placed',
  cancelled: 'Cancelled',
};
const STATUS_CLASS: Record<OrderSummary['status'], string> = {
  placed: 'bg-teal/10 text-teal-deep',
  cancelled: 'bg-red-50 text-red-600',
};
// Fulfillment & Subscriptions redesign, Phase 5b — an online order that
// hasn't cleared payment yet gets its own badge instead of the generic
// "Placed" one, since "placed" alone would misleadingly read as done.
const PAYMENT_STATUS_LABEL: Record<'pending' | 'failed', string> = {
  pending: 'Payment pending',
  failed: 'Payment failed',
};
const PAYMENT_STATUS_CLASS: Record<'pending' | 'failed', string> = {
  pending: 'bg-gold/15 text-gold-soft',
  failed: 'bg-red-50 text-red-600',
};

type RequestSummary = {
  requestNumber: string;
  status: 'initiated' | 'viewed' | 'accepted' | 'rejected' | 'completed' | 'auto_closed_no_update';
  createdAt: string;
  listingTitle: string;
  businessName: string | null;
};

const REQUEST_STATUS_LABEL: Record<RequestSummary['status'], string> = {
  initiated: 'Sent',
  viewed: 'Seen by seller',
  accepted: 'Accepted',
  rejected: 'Declined',
  completed: 'Completed',
  auto_closed_no_update: 'Closed',
};
const REQUEST_STATUS_CLASS: Record<RequestSummary['status'], string> = {
  initiated: 'bg-gold/20 text-ink',
  viewed: 'bg-navy/10 text-navy',
  accepted: 'bg-teal/10 text-teal-deep',
  rejected: 'bg-red-50 text-red-600',
  completed: 'bg-teal/10 text-teal-deep',
  auto_closed_no_update: 'bg-ink-soft/10 text-ink-soft',
};

export default function AccountPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/login?redirect=/account');
      return;
    }
    Promise.all([
      authFetch('/api/auth/me').then((res) => (res.ok ? res.json() : null)),
      authFetch('/api/orders/mine').then((res) => (res.ok ? res.json() : null)),
      authFetch('/api/requests/mine').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([me, orderData, requestData]) => {
        if (me?.user) {
          setName(me.user.name ?? '');
          setEmail(me.user.email ?? '');
          setPhone(me.user.phone);
          setHasPassword(me.user.hasPassword);
        }
        setOrders(orderData?.orders ?? []);
        setRequests(requestData?.requests ?? []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Could not save your profile.');
        return;
      }
      // The header's account pill reads the cached /api/auth/me result — it
      // won't pick up a new name on its own since the session token itself
      // didn't change (see the same fix in /login's handleSaveName).
      window.dispatchEvent(new Event('wb:auth-changed'));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPassword(event: FormEvent) {
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
      setHasPassword(true);
      setNewPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } finally {
      setPasswordSaving(false);
    }
  }

  function signOut() {
    clearAuthToken();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <RowListSkeleton count={2} withIcon={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold text-ink">
          <User className="h-6 w-6 text-navy" strokeWidth={1.75} />
          My profile
        </h1>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 font-body text-sm text-ink-soft transition hover:text-ink"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Sign out
        </button>
      </div>

      <form
        onSubmit={handleSave}
        className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5"
      >
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputStyles}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Phone number</label>
          <input value={phone} disabled className={`${inputStyles} bg-ivory-deep text-ink-soft`} />
        </div>
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={saving} className={buttonStyles('primary', 'md')}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </form>

      <form
        onSubmit={handleSetPassword}
        className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5"
      >
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Password
        </h2>
        <p className="font-body text-xs text-ink-soft">
          {hasPassword
            ? 'A password is set — sign in with it instead of an OTP each time.'
            : "No password set yet — you'll need an OTP every time you sign in until you set one."}
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={hasPassword ? 'New password' : 'Set a password (min. 8 characters)'}
          minLength={8}
          className={inputStyles}
        />
        {passwordError && <p className="font-body text-sm text-red-700">{passwordError}</p>}
        <button
          type="submit"
          disabled={passwordSaving || newPassword.length === 0}
          className={buttonStyles('secondary', 'md')}
        >
          {passwordSaving ? 'Saving…' : passwordSaved ? 'Saved ✓' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </form>

      <AddressBook />

      <SavedListings />

      <div id="orders" className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
          <Package className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
          Order history
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
            No orders placed while signed in yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/order/${order.orderNumber}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:shadow-md"
                >
                  <div>
                    <p className="font-body text-sm font-medium text-ink">#{order.orderNumber}</p>
                    <p className="font-body text-xs text-ink-soft">
                      {order.itemCount} item{order.itemCount === 1 ? '' : 's'} ·{' '}
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-body text-sm font-semibold text-navy">
                      ₹{order.total.toLocaleString('en-IN')}
                    </span>
                    {order.status === 'placed' &&
                    order.paymentMethod === 'online' &&
                    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed') ? (
                      <span
                        className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${PAYMENT_STATUS_CLASS[order.paymentStatus]}`}
                      >
                        {PAYMENT_STATUS_LABEL[order.paymentStatus]}
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${STATUS_CLASS[order.status]}`}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="requests" className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
          <MessageCircle className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
          My requests
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
            No consultation requests sent while signed in yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((req) => (
              <li key={req.requestNumber}>
                <Link
                  href={`/request/${req.requestNumber}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:shadow-md"
                >
                  <div>
                    <p className="font-body text-sm font-medium text-ink">{req.listingTitle}</p>
                    <p className="font-body text-xs text-ink-soft">
                      #{req.requestNumber} · {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${REQUEST_STATUS_CLASS[req.status]}`}
                  >
                    {REQUEST_STATUS_LABEL[req.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type SavedAddress = {
  id: number;
  label: string;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

const emptyAddressForm = {
  label: '',
  recipientName: '',
  recipientPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
};

/** Marketplace-completeness scan (2026-09-06) — checkout used to
 *  re-collect a full address fresh every single time, nothing ever
 *  saved. This is the account-side half; checkout's own picker is a
 *  separate change. */
function AddressBook() {
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState(emptyAddressForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    authFetch('/api/account/addresses')
      .then((res) => (res.ok ? res.json() : { addresses: [] }))
      .then((data) => setAddresses(data.addresses ?? []));
  }
  useEffect(load, []);

  function startEdit(addr?: SavedAddress) {
    setError(null);
    if (addr) {
      setEditing(addr.id);
      setForm({ ...addr, addressLine2: addr.addressLine2 ?? '' });
    } else {
      setEditing('new');
      setForm(emptyAddressForm);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = editing === 'new' ? '/api/account/addresses' : `/api/account/addresses/${editing}`;
      const res = await authFetch(url, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstIssue = data.issues && Object.values(data.issues)[0];
        setError((Array.isArray(firstIssue) ? firstIssue[0] : undefined) ?? data.error ?? 'Could not save this address.');
        return;
      }
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    await authFetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
    load();
  }

  async function makeDefault(id: number) {
    await authFetch(`/api/account/addresses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  return (
    <div id="addresses" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
          <MapPin className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
          Addresses
        </h2>
        {editing === null && (
          <button
            onClick={() => startEdit()}
            className="flex items-center gap-1 font-body text-sm font-medium text-navy hover:text-navy-deep"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add address
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Label (e.g. Home)"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className={inputStyles}
            />
            <input
              placeholder="Recipient name"
              value={form.recipientName}
              onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
              className={inputStyles}
            />
          </div>
          <input
            placeholder="Recipient phone"
            value={form.recipientPhone}
            onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
            className={inputStyles}
          />
          <input
            placeholder="Address line 1"
            value={form.addressLine1}
            onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
            className={inputStyles}
          />
          <input
            placeholder="Address line 2 (optional)"
            value={form.addressLine2}
            onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
            className={inputStyles}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className={inputStyles}
            />
            <input
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className={inputStyles}
            />
            <input
              placeholder="Pincode"
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className={inputStyles}
              inputMode="numeric"
            />
          </div>
          {error && <p className="font-body text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className={buttonStyles('primary', 'sm')}>
              {saving ? 'Saving…' : 'Save address'}
            </button>
            <button onClick={() => setEditing(null)} className={buttonStyles('secondary', 'sm')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {addresses === null ? (
        <RowListSkeleton count={2} withIcon={false} />
      ) : addresses.length === 0 && editing === null ? (
        <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
          No saved addresses yet — add one to skip re-entering it at checkout.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {addresses.map((addr) => (
            <li
              key={addr.id}
              className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5"
            >
              <div>
                <p className="flex items-center gap-2 font-body text-sm font-semibold text-ink">
                  {addr.label}
                  {addr.isDefault && (
                    <span className="rounded-full bg-teal/10 px-2 py-0.5 font-body text-[10px] font-semibold text-teal-deep">
                      Default
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-body text-xs text-ink-soft">
                  {addr.recipientName} · {addr.recipientPhone}
                </p>
                <p className="font-body text-xs text-ink-soft">
                  {addr.addressLine1}
                  {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city}, {addr.state} {addr.pincode}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!addr.isDefault && (
                  <button
                    onClick={() => makeDefault(addr.id)}
                    title="Set as default"
                    className="rounded-lg p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
                  >
                    <Star className="h-4 w-4" strokeWidth={2} />
                  </button>
                )}
                <button
                  onClick={() => startEdit(addr)}
                  title="Edit"
                  className="rounded-lg p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  onClick={() => remove(addr.id)}
                  title="Delete"
                  className="rounded-lg p-1.5 text-ink-soft transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SavedListing = {
  id: number;
  slug: string;
  title: string;
  price: string | null;
  businessName: string | null;
  images: { url: string }[];
};

/** Marketplace-completeness scan (2026-09-06) — didn't exist at all
 *  before this. Fetches each saved listing's own detail individually
 *  (same per-id pattern checkout already uses for cart lines) rather
 *  than duplicating the browse feed's pricing/contact-mode resolution
 *  logic just to embed a light card here. */
function SavedListings() {
  const [listings, setListings] = useState<SavedListing[] | null>(null);

  function load() {
    authFetch('/api/account/wishlist')
      .then((res) => (res.ok ? res.json() : { listingIds: [] }))
      .then((data: { listingIds: number[] }) =>
        Promise.all(
          data.listingIds.map((id) =>
            fetch(`/api/listings/${id}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((d) => d?.listing as SavedListing | undefined),
          ),
        ),
      )
      .then((results) => setListings(results.filter((l): l is SavedListing => Boolean(l))));
  }
  useEffect(load, []);

  async function remove(id: number) {
    await authFetch(`/api/account/wishlist/${id}`, { method: 'DELETE' });
    setListings((prev) => prev?.filter((l) => l.id !== id) ?? null);
  }

  return (
    <div id="saved" className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
        <Heart className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
        Saved
      </h2>
      {listings === null ? (
        <RowListSkeleton count={2} withIcon={false} />
      ) : listings.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
          Nothing saved yet — tap the heart on a listing to keep it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-soft/5"
            >
              <Link href={`/collection/${listing.slug}`} className="flex flex-1 items-center gap-3 min-w-0">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ivory-deep">
                  {listing.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
                    <img src={listing.images[0].url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-medium text-ink">{listing.title}</p>
                  <p className="truncate font-body text-xs text-ink-soft">
                    {listing.businessName}
                    {listing.price && ` · ₹${Number(listing.price).toLocaleString('en-IN')}`}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => remove(listing.id)}
                title="Remove from saved"
                className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
