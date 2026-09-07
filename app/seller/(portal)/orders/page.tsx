'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { TableSkeleton } from '@/components/skeleton';
import {
  ORDER_ITEM_STATUS_LABEL,
  nextStage,
  canMarkReturned,
  type OrderItemStatus,
} from '@/lib/order-item-status';

type Order = {
  orderNumber: string;
  buyerName: string;
  city: string;
  paymentMethod: 'cod' | 'online' | 'pickup_and_pay';
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
    // Item 28 (2026-09-07) — whose address this actually is.
    addressType: 'buyer' | 'seller';
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

  async function refreshSelected() {
    if (selected) await openOrder(selected.order.orderNumber);
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
        <OrderDetailModal detail={selected} onClose={() => setSelected(null)} onAdvance={advanceStatus} onReturned={refreshSelected} />
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
  returned: 'bg-red-50 text-red-600',
};

function OrderDetailModal({
  detail,
  onClose,
  onAdvance,
  onReturned,
}: {
  detail: OrderDetail;
  onClose: () => void;
  onAdvance: (itemId: number, status: OrderItemStatus) => void;
  onReturned: () => void;
}) {
  const total = detail.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const cancelled = detail.order.status === 'cancelled';
  const isCod = detail.order.paymentMethod === 'cod';
  // Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — no
  // packed/shipped stages mean anything here (nothing is ever shipped);
  // her one action is confirming the buyer actually collected it, which
  // is also the moment the second commission stage fires (see
  // app/api/sellers/orders/[orderNumber]'s own comment).
  const isPickupAndPay = detail.order.paymentMethod === 'pickup_and_pay';
  const [returnFormOpenFor, setReturnFormOpenFor] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnBusy, setReturnBusy] = useState(false);

  async function submitReturn(itemId: number) {
    if (returnReason.trim().length < 10) {
      setReturnError('Tell us a bit more — at least 10 characters.');
      return;
    }
    setReturnBusy(true);
    setReturnError(null);
    try {
      const res = await authFetch(`/api/sellers/order-items/${itemId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: returnReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReturnError(data.error ?? 'Could not flag this item as returned.');
        return;
      }
      setReturnFormOpenFor(null);
      setReturnReason('');
      onReturned();
    } finally {
      setReturnBusy(false);
    }
  }

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
          {/* Item 28 (2026-09-07) — before this, a pickup order showed her
           *  buyer's name paired right above HER OWN address with no
           *  distinction at all. addressType now drives which is which. */}
          {detail.order.addressType === 'seller' ? (
            <p className="font-medium text-ink">Pickup location (your own address)</p>
          ) : (
            <p className="font-medium text-ink">{detail.order.buyerName}</p>
          )}
          <p>
            {detail.order.addressLine1}
            {detail.order.addressLine2 ? `, ${detail.order.addressLine2}` : ''}
          </p>
          <p>
            {detail.order.city}, {detail.order.state} {detail.order.pincode}
          </p>
          {detail.order.addressType === 'seller' && (
            <p className="mt-1">Buyer: {detail.order.buyerName}</p>
          )}
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
                  {!cancelled && isPickupAndPay && item.status !== 'delivered' && item.status !== 'cancelled' && item.status !== 'returned' && (
                    <button
                      onClick={() => onAdvance(item.id, 'delivered')}
                      className="rounded-full bg-navy px-3 py-1.5 font-body text-xs font-semibold text-ivory transition hover:bg-navy-deep"
                    >
                      Mark as picked up
                    </button>
                  )}
                  {!cancelled && !isPickupAndPay && next && (
                    <button
                      onClick={() => onAdvance(item.id, next)}
                      className="rounded-full bg-navy px-3 py-1.5 font-body text-xs font-semibold text-ivory transition hover:bg-navy-deep"
                    >
                      Mark as {ORDER_ITEM_STATUS_LABEL[next]}
                    </button>
                  )}
                  {!cancelled && isCod && canMarkReturned(item.status) && (
                    <button
                      onClick={() => setReturnFormOpenFor(returnFormOpenFor === item.id ? null : item.id)}
                      className="rounded-full border border-red-200 px-3 py-1.5 font-body text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Mark as returned
                    </button>
                  )}
                </div>

                {returnFormOpenFor === item.id && (
                  <div className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-red-100">
                    <p className="font-body text-xs text-ink-soft">
                      This opens a dispute so admin can verify with the buyer and credit your wallet back for this
                      item&apos;s commission — a CoD delivery can&apos;t be refunded like an online payment.
                    </p>
                    <input
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="What happened? (min. 10 characters)"
                      className="w-full rounded-lg border border-ink-soft/15 px-3 py-1.5 font-body text-xs text-ink placeholder:text-ink-soft/60 focus:border-navy/40 focus:outline-none"
                    />
                    {returnError && <p className="font-body text-xs text-red-600">{returnError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => submitReturn(item.id)}
                        disabled={returnBusy}
                        className="rounded-full bg-red-600 px-3 py-1.5 font-body text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm return
                      </button>
                      <button
                        onClick={() => {
                          setReturnFormOpenFor(null);
                          setReturnReason('');
                          setReturnError(null);
                        }}
                        disabled={returnBusy}
                        className="rounded-full border border-ink-soft/15 px-3 py-1.5 font-body text-xs font-semibold text-ink-soft transition hover:bg-ivory-deep"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
