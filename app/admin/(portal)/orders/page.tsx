'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { inputStyles } from '@/lib/button-styles';
import { TableSkeleton } from '@/components/skeleton';

type Order = {
  orderNumber: string;
  buyerName: string;
  buyerPhone: string;
  city: string;
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  status: 'placed' | 'cancelled';
  createdAt: string;
  itemCount: number;
  total: number;
};

const PAYMENT_STATUS_CLASS: Record<'pending' | 'paid' | 'failed' | 'refunded', string> = {
  pending: 'bg-gold/15 text-gold-soft',
  paid: 'bg-teal/10 text-teal-deep',
  failed: 'bg-red-50 text-red-600',
  refunded: 'bg-navy/10 text-navy',
};
const PAYMENT_STATUS_LABEL: Record<'pending' | 'paid' | 'failed' | 'refunded', string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

const STATUS_CLASS: Record<Order['status'], string> = {
  placed: 'bg-teal/10 text-teal-deep',
  cancelled: 'bg-red-50 text-red-600',
};

/**
 * /admin/orders — every order, deliberately INCLUDING an 'online' order
 * that hasn't been paid for yet (see the list API's own comment). Rows
 * link through to /admin/orders/[orderNumber] — the "whole transaction"
 * view (item status, real payment record, seller payouts, refunds,
 * disputes) — this page itself is deliberately just the filterable list.
 */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState<'all' | Order['status']>('all');
  const [q, setQ] = useState('');

  async function load() {
    setOrders(null);
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (q) params.set('q', q);
    const res = await authFetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Orders</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Every order placed on the platform, for support and oversight.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
          {[
            { key: 'all', label: 'All' },
            { key: 'placed', label: 'Placed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key as typeof status)}
              className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                status === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Order #, name, or phone…"
            className={`${inputStyles} w-64 pl-9`}
          />
        </form>
      </div>

      {orders === null ? (
        <TableSkeleton columns={7} rows={5} />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <ShoppingBag className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No orders match.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
          <table className="w-full min-w-[640px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Order</th>
                <th className="px-2 py-3">Buyer</th>
                <th className="px-2 py-3">City</th>
                <th className="px-2 py-3">Items</th>
                <th className="px-2 py-3">Total</th>
                <th className="px-2 py-3">Payment</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderNumber} className="border-b border-ink-soft/5 last:border-0 hover:bg-ivory-deep/40">
                  <td className="p-0">
                    <Link href={`/admin/orders/${o.orderNumber}`} className="block px-4 py-3 font-medium text-ink">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-ink-soft">{o.buyerName}</td>
                  <td className="px-2 py-3 text-ink-soft">{o.city}</td>
                  <td className="px-2 py-3 text-ink-soft">{o.itemCount}</td>
                  <td className="px-2 py-3 text-ink">₹{o.total.toLocaleString('en-IN')}</td>
                  <td className="px-2 py-3">
                    {o.paymentMethod === 'cod' ? (
                      <span className="font-body text-xs text-ink-soft">COD</span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PAYMENT_STATUS_CLASS[o.paymentStatus ?? 'pending']}`}
                      >
                        {PAYMENT_STATUS_LABEL[o.paymentStatus ?? 'pending']}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-ink-soft">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
