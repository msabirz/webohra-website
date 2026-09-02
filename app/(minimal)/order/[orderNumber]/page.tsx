'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, Home, MapPinned, Wallet, XCircle } from 'lucide-react';
import { buttonStyles } from '@/lib/button-styles';
import { TrackingPageSkeleton } from '@/components/skeleton';
import { ORDER_ITEM_STATUS_LABEL, stageIndex, type OrderItemStatus } from '@/lib/order-item-status';

type OrderItem = {
  id: number;
  title: string;
  subcategoryName: string;
  businessName: string | null;
  // Set when this line was a specific type of a variant-based listing —
  // frozen at order time, same as unitPrice, so it reads correctly even if
  // the type is later renamed or removed.
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  status: OrderItemStatus;
};

type OrderDetail = {
  orderNumber: string;
  buyerName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: 'cod' | 'online';
  status: 'placed' | 'cancelled';
  createdAt: string;
};

// Fulfillment & Subscriptions redesign, Phase 3 — one row per (seller,
// method); charge is null for a method with no real cost yet (Delhivery).
type OrderShipment = {
  sellerId: number;
  method: 'self_managed' | 'delhivery';
  charge: string | null;
  businessName: string | null;
};

const STEPS = [
  { icon: CheckCircle2, label: 'Order placed' },
  { icon: Package, label: 'Seller prepares' },
  { icon: Truck, label: 'Shipped' },
  { icon: Home, label: 'Delivered' },
];

export default function OrderConfirmationPage() {
  const params = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [shipmentList, setShipmentList] = useState<OrderShipment[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function load() {
    fetch(`/api/orders/${params.orderNumber}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items ?? []);
        setShipmentList(data.shipments ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orderNumber]);

  async function handleCancel() {
    if (!confirm('Cancel this order? This can’t be undone.')) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/${params.orderNumber}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? 'Could not cancel this order.');
        return;
      }
      load();
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <TrackingPageSkeleton />;
  if (notFound || !order) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-heading text-xl font-semibold text-ink">Order not found</p>
        <Link href="/" className="font-body text-sm text-navy underline">
          Back to home
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const shippingTotal = shipmentList.reduce((sum, s) => sum + Number(s.charge ?? 0), 0);
  const total = subtotal + shippingTotal;
  // An order can span several sellers, each fulfilling on her own timeline —
  // the overall bar only advances once every one of them has reached that
  // stage, same as the item-level pills shown below never getting ahead of
  // what each seller has actually recorded.
  const orderStage = items.length
    ? Math.min(...items.map((item) => stageIndex(item.status)))
    : 0;
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {order.status === 'cancelled' ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-red-50 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-600" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">Order cancelled</h1>
          <p className="font-body text-sm text-ink-soft">Order #{order.orderNumber}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-gradient-to-b from-teal/10 to-transparent px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/15">
            <CheckCircle2 className="h-8 w-8 text-teal-deep" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">
            Thanks, {order.buyerName}!
          </h1>
          <p className="font-body text-sm text-ink-soft">
            Order #{order.orderNumber} · Placed {orderDate}
          </p>
        </div>
      )}

      {order.status === 'placed' && (
        <>
          {/* Status steps */}
          <div className="relative flex items-start justify-between rounded-2xl bg-white px-4 py-6 shadow-sm ring-1 ring-ink-soft/5">
            <div className="absolute left-[12.5%] right-[12.5%] top-[34px] h-0.5 bg-ink-soft/10" />
            {STEPS.map((step, i) => (
              <div
                key={step.label}
                className="relative flex flex-1 flex-col items-center gap-2 text-center"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    i <= orderStage ? 'bg-teal text-ivory' : 'bg-ivory-deep text-ink-soft/50'
                  }`}
                >
                  <step.icon className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <span className="font-body text-[11px] leading-tight text-ink-soft">
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center font-body text-xs text-ink-soft">
            Self-managed shipping is seller-reported — you&apos;ll see updates here as she
            records them, not live carrier tracking.
            {items.length > 1 && ' With more than one seller in this order, it only advances once every one of them has caught up.'}
          </p>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <MapPinned className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Shipping address
          </h2>
          <p className="font-body text-sm text-ink">{order.buyerName}</p>
          <p className="font-body text-sm text-ink-soft">
            {order.addressLine1}
            {order.addressLine2 ? `, ${order.addressLine2}` : ''}
          </p>
          <p className="font-body text-sm text-ink-soft">
            {order.city}, {order.state} {order.pincode}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <Wallet className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Payment
          </h2>
          <p className="font-body text-sm text-ink">
            {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}
          </p>
          <p className="mt-2 font-body text-xs text-ink-soft">
            Track this order anytime using order #{order.orderNumber} from the site footer.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="mb-3 font-heading text-sm font-semibold text-ink">Items</h2>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-sm font-medium text-ink">
                  {item.title}
                  {item.variantName && ` — ${item.variantName}`} × {item.quantity}
                </p>
                <p className="font-body text-xs text-ink-soft">
                  {item.businessName} · {item.subcategoryName}
                </p>
                {order.status === 'placed' && (
                  <span className="mt-1 inline-flex rounded-full bg-teal/10 px-2 py-0.5 font-body text-[10px] font-semibold text-teal-deep">
                    {ORDER_ITEM_STATUS_LABEL[item.status]}
                  </span>
                )}
              </div>
              <p className="font-body text-sm font-semibold text-navy">
                ₹{(Number(item.unitPrice) * item.quantity).toLocaleString('en-IN')}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-1.5 border-t border-ink-soft/10 pt-3 font-body text-sm">
          <div className="flex items-center justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          {shipmentList.map((s) => (
            <div key={`${s.sellerId}-${s.method}`} className="flex items-center justify-between text-ink-soft">
              <span>
                Shipping{shipmentList.length > 1 && s.businessName ? ` — ${s.businessName}` : ''}
                {s.method === 'delhivery' ? ' (Delhivery)' : ''}
              </span>
              <span>{s.charge && Number(s.charge) > 0 ? `₹${Number(s.charge).toLocaleString('en-IN')}` : 'Free'}</span>
            </div>
          ))}
          <div className="flex items-center justify-between font-semibold text-ink">
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {cancelError && <p className="text-center font-body text-sm text-red-700">{cancelError}</p>}

      {order.status === 'placed' && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className={buttonStyles('secondary', 'md', 'text-red-600')}
        >
          {cancelling ? 'Cancelling…' : 'Cancel this order'}
        </button>
      )}

      <Link href="/" className={buttonStyles('primary', 'lg')}>
        Continue shopping
      </Link>
    </div>
  );
}
