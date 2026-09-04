'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { User, CheckCircle2, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { RowListSkeleton } from '@/components/skeleton';

type Customer = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string;
  phoneVerified: boolean;
  createdAt: string;
  orderCount: number;
  lifetimeSpend: number;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  createdAt: string;
  totalRupees: number;
};

/** /admin/customers/[id] — one buyer's full order history and lifetime
 *  spend, the customer-facing equivalent of /admin/sellers/[id]. */
export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    authFetch(`/api/admin/customers/${params.id}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setCustomer(data.customer);
        setOrders(data.orders ?? []);
      });
  }, [params.id]);

  if (notFound) {
    return <p className="font-body text-sm text-ink-soft">Customer not found.</p>;
  }

  if (!customer) return <RowListSkeleton count={4} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/5">
          <User className="h-6 w-6 text-navy" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {customer.name ?? customer.email ?? customer.phone}
          </h1>
          <p className="mt-0.5 font-body text-sm text-ink-soft">
            {customer.email && `${customer.email} · `}
            {customer.phone}
            {customer.phoneVerified && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-teal-deep">
                <CheckCircle2 className="inline h-3.5 w-3.5" strokeWidth={2.5} /> verified
              </span>
            )}
            {' · Joined '}
            {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">Lifetime orders</p>
          <p className="mt-1 font-heading text-2xl font-semibold text-ink">{customer.orderCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">Lifetime spend</p>
          <p className="mt-1 font-heading text-2xl font-semibold text-navy">
            ₹{customer.lifetimeSpend.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-ink">Order history</h2>
        {orders === null ? (
          <RowListSkeleton count={3} />
        ) : orders.length === 0 ? (
          <p className="font-body text-sm text-ink-soft">No orders yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.orderNumber}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 transition hover:ring-navy/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm font-semibold text-ink">{o.orderNumber}</p>
                  <p className="truncate font-body text-xs text-ink-soft">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {o.paymentMethod === 'cod' ? 'Cash on Delivery' : (o.paymentStatus ?? 'pending')}
                  </p>
                </div>
                <p className="shrink-0 font-body text-sm font-semibold text-navy">
                  ₹{o.totalRupees.toLocaleString('en-IN')}
                </p>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={2} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
