'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, Home, MapPinned, Wallet, XCircle, AlertCircle, Flag } from 'lucide-react';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { TrackingPageSkeleton } from '@/components/skeleton';
import { ORDER_ITEM_STATUS_LABEL, stageIndex, isOrderItemStage, type OrderItemStatus } from '@/lib/order-item-status';
import { loadRazorpayScript } from '@/lib/razorpay-client';

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
  // Item 28 (2026-09-07) — the real source of truth for whose address the
  // fields above actually hold; drives the label below instead of
  // re-deriving it from paymentMethod.
  addressType: 'buyer' | 'seller';
  paymentMethod: 'cod' | 'online' | 'pickup_and_pay';
  // Fulfillment & Subscriptions redesign, Phase 5b — null for COD (see
  // orders.paymentStatus' own comment in db/schema.ts). razorpayOrderId/
  // razorpayKeyId/retryAmountRupees are only ever non-null together, and
  // only while there's a real payment left to complete.
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  razorpayOrderId: string | null;
  razorpayKeyId: string | null;
  retryAmountRupees: number | null;
  status: 'placed' | 'cancelled';
  createdAt: string;
};

// Fulfillment & Subscriptions redesign, Phase 3 — one row per (seller,
// method); charge is null for a method with no real cost yet (Delhivery).
type OrderShipment = {
  sellerId: number;
  method: 'self_managed' | 'delhivery' | 'pickup_and_pay';
  charge: string | null;
  businessName: string | null;
  // Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — only ever
  // set for method: 'pickup_and_pay'.
  pickupScheduledDate: string | null;
  pickupScheduledTime: string | null;
  pickupCompletedAt: string | null;
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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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

  /**
   * Opens the SAME Razorpay order created at checkout (order.razorpayOrderId)
   * — this is the one place that widget-opening code lives; checkout itself
   * just creates the order and redirects here, whether this is her first
   * payment attempt or a retry after a failed/abandoned one. Fulfillment &
   * Subscriptions redesign, Phase 5b.
   */
  async function payNow() {
    if (!order?.razorpayOrderId || !order.razorpayKeyId || order.retryAmountRupees === null) return;
    setPaying(true);
    setPayError(null);
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) {
        setPayError('Could not load the payment window. Check your connection and try again.');
        setPaying(false);
        return;
      }
      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: Math.round(order.retryAmountRupees * 100),
        currency: 'INR',
        order_id: order.razorpayOrderId,
        name: 'WE Bohra',
        description: `Order ${order.orderNumber}`,
        prefill: { name: order.buyerName },
        theme: { color: '#1B3A6B' },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch(`/api/orders/${params.orderNumber}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          if (verifyRes.ok) {
            load();
          } else {
            const verifyData = await verifyRes.json();
            setPayError(verifyData.error ?? 'Payment succeeded but could not be confirmed — refresh this page in a moment, or contact WeBohra support.');
          }
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      razorpay.open();
    } catch {
      setPayError('Something went wrong starting the payment. Try again.');
      setPaying(false);
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
  // what each seller has actually recorded. A cancelled item (added
  // 2026-09-03) has no stage of its own and is excluded here entirely —
  // it should never be the one holding back the progress bar for
  // everything else still genuinely being fulfilled.
  const activeStages = items.map((item) => item.status).filter(isOrderItemStage).map(stageIndex);
  const orderStage = activeStages.length ? Math.min(...activeStages) : 0;
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Fulfillment & Subscriptions redesign, Phase 5b — a real order row
  // exists the instant checkout submits, but for 'online' that's not the
  // same as money having actually arrived. Nothing below treats one of
  // these as a normal, fulfillable order — matches Admin/seller order
  // lists hiding it entirely until this flips. Deliberately an explicit
  // allow-list (pending/failed), not "!== 'paid'" — 'refunded' (added
  // 2026-09-03) is also never 'paid', but a refunded order is the
  // opposite of unpaid and must never show a "complete your payment"
  // banner or a live retry button against money that's already been
  // both charged and given back.
  const isUnpaidOnline =
    order.paymentMethod === 'online' && (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');
  // Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — single-
  // item/single-seller by design, so there's ever at most one shipment
  // row to look at here.
  const isPickupAndPay = order.paymentMethod === 'pickup_and_pay';
  const pickupShipment = isPickupAndPay ? shipmentList[0] : undefined;
  // Item 28 (2026-09-07) — the address-label decision below now reads
  // this instead of re-deriving it from paymentMethod, since that's
  // literally what this field exists to say.
  const isSellerAddress = order.addressType === 'seller';

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
      ) : isUnpaidOnline ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-gold/10 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/20">
            <AlertCircle className="h-8 w-8 text-ink" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">
            {order.paymentStatus === 'failed' ? 'Payment failed' : 'Almost there — complete your payment'}
          </h1>
          <p className="font-body text-sm text-ink-soft">
            Order #{order.orderNumber} · Saved {orderDate}
            {order.paymentStatus === 'failed'
              ? '. Your card wasn\'t charged — try again below.'
              : '. Nothing has been charged yet — this order won\'t reach the seller until payment clears.'}
          </p>
          {order.razorpayOrderId && (
            <button onClick={payNow} disabled={paying} className={buttonStyles('primary', 'lg')}>
              {paying ? 'Opening payment…' : `Pay ₹${(order.retryAmountRupees ?? 0).toLocaleString('en-IN')} now`}
            </button>
          )}
          {payError && <p className="font-body text-sm text-red-700">{payError}</p>}
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

      {order.status === 'placed' && !isUnpaidOnline && (
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
            {isSellerAddress ? 'Pickup location' : 'Shipping address'}
          </h2>
          {/* Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) —
           *  these columns hold the SELLER's own resolved pickup address
           *  for this payment method, not a delivery destination (see
           *  orders.addressLine1's own schema comment) — buyerName is
           *  deliberately omitted here, it isn't her address. Driven by
           *  addressType (item 28, 2026-09-07), not paymentMethod — this
           *  is what that field exists for. */}
          {!isSellerAddress && <p className="font-body text-sm text-ink">{order.buyerName}</p>}
          <p className="font-body text-sm text-ink-soft">
            {order.addressLine1}
            {order.addressLine2 ? `, ${order.addressLine2}` : ''}
          </p>
          <p className="font-body text-sm text-ink-soft">
            {order.city}, {order.state} {order.pincode}
          </p>
          {pickupShipment?.pickupScheduledDate && (
            <p className="mt-2 font-body text-xs font-medium text-ink">
              Booked for {new Date(`${pickupShipment.pickupScheduledDate}T${pickupShipment.pickupScheduledTime ?? '00:00'}`).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <Wallet className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Payment
          </h2>
          <p className="font-body text-sm text-ink">
            {order.paymentMethod === 'cod'
              ? 'Cash on Delivery'
              : order.paymentMethod === 'pickup_and_pay'
                ? pickupShipment?.pickupCompletedAt
                  ? 'Paid the seller in person'
                  : 'Pay the seller in person at pickup'
                : order.paymentStatus === 'paid'
                  ? 'Paid online'
                  : order.paymentStatus === 'refunded'
                    ? 'Refunded'
                    : order.paymentStatus === 'failed'
                      ? 'Payment failed'
                      : 'Payment pending'}
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
                {order.status === 'placed' && !isUnpaidOnline && (
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${
                      item.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-teal/10 text-teal-deep'
                    }`}
                  >
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
          {shipmentList
            .filter((s) => s.method !== 'pickup_and_pay')
            .map((s) => (
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

      {order.status === 'placed' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded' && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className={buttonStyles('secondary', 'md', 'text-red-600')}
        >
          {cancelling ? 'Cancelling…' : 'Cancel this order'}
        </button>
      )}

      {order.status === 'placed' && !isUnpaidOnline && (
        <ReportIssue orderNumber={order.orderNumber} sellers={shipmentList} />
      )}

      <Link href="/" className={buttonStyles('primary', 'lg')}>
        Continue shopping
      </Link>
    </div>
  );
}

type Dispute = { id: number; status: 'open' | 'investigating' | 'resolved'; reason: string; createdAt: string };

/**
 * "Report an issue" (2026-09-06, marketplace-completeness scan) — there
 * was genuinely no buyer-facing way to raise a dispute before this, only
 * staff could open one. Works for guest checkout too, same order-number
 * trust model as the rest of this page. If the order has more than one
 * seller, she has to pick which one it's about (the precision fix — see
 * disputes.sellerId's own schema comment) rather than it silently
 * bleeding through to every seller in the order.
 */
function ReportIssue({ orderNumber, sellers }: { orderNumber: string; sellers: OrderShipment[] }) {
  const distinctSellers = Array.from(new Map(sellers.map((s) => [s.sellerId, s])).values());
  const [existing, setExisting] = useState<Dispute | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sellerId, setSellerId] = useState<number | ''>(distinctSellers.length === 1 ? distinctSellers[0].sellerId : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${orderNumber}/disputes`)
      .then((res) => (res.ok ? res.json() : { activeDispute: null }))
      .then((data) => setExisting(data.activeDispute));
  }, [orderNumber]);

  async function submit() {
    if (reason.trim().length < 10) {
      setError('Tell us a bit more — at least 10 characters.');
      return;
    }
    if (distinctSellers.length > 1 && !sellerId) {
      setError('This order has more than one seller — pick which one this is about.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), ...(sellerId && { sellerId }) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send this.');
        return;
      }
      setExisting(data.dispute);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (existing === undefined) return null;

  if (existing) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-gold/10 px-4 py-3 font-body text-sm text-ink">
        <Flag className="h-4 w-4 shrink-0 text-gold-soft" strokeWidth={2} />
        You reported an issue on this order — we&apos;re looking into it.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 font-body text-sm font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        <Flag className="h-3.5 w-3.5" strokeWidth={2} />
        Report an issue with this order
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
      <h2 className="font-heading text-sm font-semibold text-ink">Report an issue</h2>
      {distinctSellers.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink-soft">Which seller is this about?</span>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(Number(e.target.value))}
            className={inputStyles}
          >
            <option value="" disabled>
              Choose a seller
            </option>
            {distinctSellers.map((s) => (
              <option key={s.sellerId} value={s.sellerId}>
                {s.businessName ?? `Seller #${s.sellerId}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What went wrong?"
        rows={4}
        className={inputStyles}
      />
      {error && <p className="font-body text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting} className={buttonStyles('primary', 'sm')}>
          {submitting ? 'Sending…' : 'Send report'}
        </button>
        <button onClick={() => setOpen(false)} className={buttonStyles('secondary', 'sm')}>
          Cancel
        </button>
      </div>
    </div>
  );
}
