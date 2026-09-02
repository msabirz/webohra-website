'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Package, LogOut, KeyRound, MessageCircle } from 'lucide-react';
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
