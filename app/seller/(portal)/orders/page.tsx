'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { TableSkeleton } from '@/components/skeleton';
import {
  ORDER_ITEM_STATUS_LABEL,
  nextStage,
  type OrderItemStatus,
} from '@/lib/order-item-status';

type Order = {
  orderNumber: string;
  buyerName: string;
  city: string;
  paymentMethod: 'cod' | 'online';
  status: 'placed' | 'cancelled';
  createdAt: string;
  itemCount: number;
  total: number;
};

type OrderDetailItem = {
  id: number;
  listingId: number;
  quantity: number;
  unitPrice: string;
  title: string;
  subcategoryName: string;
  variantName: string | null;
  status: OrderItemStatus;
  statusUpdatedAt: string | null;
};

type OrderDetail = {
  order: {
    orderNumber: string;
    buyerName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    paymentMethod: string;
    status: string;
    createdAt: string;
  };
  items: OrderDetailItem[];
};

const STATUS_CLASS: Record<Order['status'], string> = {
  placed: 'bg-teal/10 text-teal-deep',
  cancelled: 'bg-red-50 text-red-600',
};

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [selected, setSelected] = useState<OrderDetail | null>(null);

  useEffect(() => {
    authFetch('/api/sellers/orders')
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []));
  }, []);

  async function openOrder(orderNumber: string) {
    const res = await authFetch(`/api/sellers/orders/${orderNumber}`);
    if (res.ok) setSelected(await res.json());
  }

  async function advanceStatus(itemId: number, status: OrderItemStatus) {
    if (!selected) return;
    const res = await authFetch(`/api/sellers/orders/${selected.order.orderNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, status }),
    });
    if (res.ok) openOrder(selected.order.orderNumber);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Orders received</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Orders containing your products. Totals and items shown are your share only.
        </p>
      </div>

      {orders === null ? (
        <TableSkeleton columns={7} rows={5} />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <ShoppingBag className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
          <table className="w-full min-w-[600px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Order</th>
                <th className="px-2 py-3">Buyer</th>
                <th className="px-2 py-3">City</th>
                <th className="px-2 py-3">Items</th>
                <th className="px-2 py-3">Your total</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.orderNumber}
                  onClick={() => openOrder(o.orderNumber)}
                  className="cursor-pointer border-b border-ink-soft/5 last:border-0 hover:bg-ivory-deep/40"
                >
                  <td className="px-4 py-3 font-medium text-ink">{o.orderNumber}</td>
                  <td className="px-2 py-3 text-ink-soft">{o.buyerName}</td>
                  <td className="px-2 py-3 text-ink-soft">{o.city}</td>
                  <td className="px-2 py-3 text-ink-soft">{o.itemCount}</td>
                  <td className="px-2 py-3 text-ink">₹{o.total.toLocaleString('en-IN')}</td>
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

      {selected && (
        <OrderDetailModal detail={selected} onClose={() => setSelected(null)} onAdvance={advanceStatus} />
      )}
    </div>
  );
}

const ITEM_STATUS_CLASS: Record<OrderItemStatus, string> = {
  placed: 'bg-ivory-deep text-ink-soft',
  packed: 'bg-gold/15 text-gold-soft',
  shipped: 'bg-navy/10 text-navy',
  delivered: 'bg-teal/15 text-teal-deep',
  cancelled: 'bg-red-50 text-red-600',
};

function OrderDetailModal({
  detail,
  onClose,
  onAdvance,
}: {
  detail: OrderDetail;
  onClose: () => void;
  onAdvance: (itemId: number, status: OrderItemStatus) => void;
}) {
  const total = detail.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const cancelled = detail.order.status === 'cancelled';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Order {detail.order.orderNumber}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="rounded-xl bg-ivory-deep/60 p-4 font-body text-sm text-ink-soft">
          <p className="font-medium text-ink">{detail.order.buyerName}</p>
          <p>
            {detail.order.addressLine1}
            {detail.order.addressLine2 ? `, ${detail.order.addressLine2}` : ''}
          </p>
          <p>
            {detail.order.city}, {detail.order.state} {detail.order.pincode}
          </p>
          <p className="mt-1">
            Payment: {detail.order.paymentMethod.toUpperCase()} · Status: {detail.order.status}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">Your items</p>
          {detail.items.map((item) => {
            const next = nextStage(item.status);
            return (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl bg-ivory-deep/40 p-3">
                <div className="flex items-center justify-between font-body text-sm">
                  <div>
                    <p className="text-ink">
                      {item.title}
                      {item.variantName && ` — ${item.variantName}`} × {item.quantity}
                    </p>
                    <p className="text-xs text-ink-soft">{item.subcategoryName}</p>
                  </div>
                  <p className="text-ink">₹{(Number(item.unitPrice) * item.quantity).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${ITEM_STATUS_CLASS[item.status]}`}>
                    {ORDER_ITEM_STATUS_LABEL[item.status]}
                  </span>
                  {!cancelled && next && (
                    <button
                      onClick={() => onAdvance(item.id, next)}
                      className="rounded-full bg-navy px-3 py-1.5 font-body text-xs font-semibold text-ivory transition hover:bg-navy-deep"
                    >
                      Mark as {ORDER_ITEM_STATUS_LABEL[next]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-ink-soft/10 pt-3 font-body text-sm font-semibold text-ink">
          <span>Your total</span>
          <span>₹{total.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
}
