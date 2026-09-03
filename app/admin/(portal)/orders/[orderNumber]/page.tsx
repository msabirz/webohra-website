'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Landmark,
  ShoppingBag,
  AlertTriangle,
  ReceiptText,
  Flag,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton } from '@/components/skeleton';
import { useAdminPortal } from '@/lib/admin-context';
import { ORDER_ITEM_STATUS_LABEL, nextStage, canCancelItem, type OrderItemStatus } from '@/lib/order-item-status';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | null;
type PayoutStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'reversed';
type DisputeStatus = 'open' | 'investigating' | 'resolved';

type OrderItem = {
  id: number;
  listingId: number;
  sellerId: number;
  quantity: number;
  unitPrice: string;
  title: string;
  subcategoryName: string;
  businessName: string | null;
  variantName: string | null;
  status: OrderItemStatus;
  statusUpdatedAt: string | null;
  cancelledReason: string | null;
};

type Shipment = { sellerId: number; method: 'self_managed' | 'delhivery'; charge: string | null; businessName: string | null };

type Payout = {
  id: number;
  sellerId: number;
  businessName: string | null;
  netAmount: string;
  status: PayoutStatus;
  channel: 'razorpayx' | 'manual' | null;
  processedAt: string | null;
};

type Refund = {
  id: number;
  amount: string;
  reason: string;
  status: 'processing' | 'processed' | 'failed';
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
};

type DisputeComment = {
  id: number;
  note: string | null;
  statusChangedTo: DisputeStatus | null;
  createdAt: string;
  staffName: string | null;
  staffEmail: string | null;
};

type Dispute = {
  id: number;
  status: DisputeStatus;
  reason: string;
  assignedToStaffId: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  comments: DisputeComment[];
};

type OrderDetail = {
  order: {
    orderNumber: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    paymentMethod: 'cod' | 'online';
    paymentStatus: PaymentStatus;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    status: 'placed' | 'cancelled';
    createdAt: string;
  };
  items: OrderItem[];
  shipments: Shipment[];
  payouts: Payout[];
  payment: { total: number; refundedAmount: number; remainingRefundable: number; refundable: boolean; payoutWarning: string | null };
  refunds: Refund[];
  disputes: Dispute[];
};

type StaffOption = { id: number; name: string | null; email: string | null; staffRole: string };

const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  processed: 'Paid out',
  failed: 'Failed',
  reversed: 'Reversed',
};
const PAYOUT_STATUS_CLASS: Record<PayoutStatus, string> = {
  pending: 'bg-ivory-deep text-ink-soft',
  processing: 'bg-gold/15 text-gold-soft',
  processed: 'bg-teal/10 text-teal-deep',
  failed: 'bg-red-50 text-red-600',
  reversed: 'bg-red-50 text-red-600',
};

const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
};
const DISPUTE_STATUS_CLASS: Record<DisputeStatus, string> = {
  open: 'bg-red-50 text-red-600',
  investigating: 'bg-gold/15 text-gold-soft',
  resolved: 'bg-teal/10 text-teal-deep',
};
const DISPUTE_STATUS_ICON: Record<DisputeStatus, typeof Clock> = {
  open: AlertTriangle,
  investigating: RefreshCw,
  resolved: CheckCircle2,
};

/**
 * /admin/orders/[orderNumber] — the "whole transaction" view: buyer +
 * shipping, the real payment record, every seller's item/shipment/payout
 * status, refund history + a real refund action, and every dispute ever
 * opened on this order — Admin Panel transaction/dispute/refund tooling,
 * 2026-09-03. Backs onto GET /api/admin/orders/[orderNumber] for
 * everything read here; the money-moving refund action is isAdmin-gated
 * at its own route even though this whole page is isStaff-readable.
 */
export default function AdminOrderDetailPage() {
  const params = useParams<{ orderNumber: string }>();
  const { me } = useAdminPortal();
  const canRefund = me.staffRole === 'admin' || me.staffRole === 'super_admin';

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeNoteDrafts, setDisputeNoteDrafts] = useState<Record<number, string>>({});

  const [selectedForCancel, setSelectedForCancel] = useState<Set<number>>(new Set());
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch(`/api/admin/orders/${params.orderNumber}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setDetail(data);
  }, [params.orderNumber]);

  useEffect(() => {
    load();
    authFetch('/api/admin/staff-directory')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStaff(data.staff);
      })
      .catch(() => {});
  }, [load]);

  async function advanceItem(itemId: number, status: OrderItemStatus) {
    setBusy(true);
    try {
      await authFetch(`/api/admin/orders/${params.orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, status }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  function toggleCancelSelection(itemId: number) {
    setSelectedForCancel((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function submitCancelItems() {
    setError(null);
    if (selectedForCancel.size === 0) {
      setError('Select at least one item to cancel.');
      return;
    }
    if (cancelReason.trim().length < 5) {
      setError('Explain why these items are being cancelled.');
      return;
    }
    setCancelling(true);
    try {
      const res = await authFetch(`/api/admin/orders/${params.orderNumber}/cancel-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedForCancel), reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not cancel these items.');
        return;
      }
      if (data.refund && !data.refund.ok) {
        setError(
          `Item(s) cancelled, but the ₹${data.refundAmount.toLocaleString('en-IN')} refund failed: ${data.refund.error} — retry it below via "Refund buyer".`,
        );
      }
      setSelectedForCancel(new Set());
      setCancelReason('');
      await load();
    } finally {
      setCancelling(false);
    }
  }

  async function submitRefund() {
    setError(null);
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid refund amount.');
      return;
    }
    if (refundReason.trim().length < 5) {
      setError('Explain why this order is being refunded.');
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/orders/${params.orderNumber}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRupees: amount, reason: refundReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not process this refund.');
        return;
      }
      setRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitDispute() {
    setError(null);
    if (disputeReason.trim().length < 5) {
      setError('Describe the issue.');
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/orders/${params.orderNumber}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not open this dispute.');
        return;
      }
      setDisputeOpen(false);
      setDisputeReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function updateDispute(
    disputeId: number,
    changes: { note?: string; status?: DisputeStatus; assignedToStaffId?: number | null },
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not update this dispute.');
        return;
      }
      setDisputeNoteDrafts((prev) => ({ ...prev, [disputeId]: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return <p className="font-body text-sm text-ink-soft">Order not found.</p>;
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { order, items, shipments, payouts, payment, refunds, disputes } = detail;
  const itemsBySeller = new Map<number, { businessName: string | null; items: OrderItem[] }>();
  for (const item of items) {
    const existing = itemsBySeller.get(item.sellerId) ?? { businessName: item.businessName, items: [] };
    existing.items.push(item);
    itemsBySeller.set(item.sellerId, existing);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/orders" className="flex w-fit items-center gap-1.5 font-body text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">{order.orderNumber}</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Placed {new Date(order.createdAt).toLocaleString('en-IN')}
            {order.status === 'cancelled' && ' · Cancelled'}
          </p>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">{error}</p>}

      {/* Buyer & shipping */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="font-heading text-sm font-semibold text-ink">Buyer</h2>
        <div className="mt-3 grid gap-3 font-body text-sm text-ink-soft sm:grid-cols-2">
          <p><span className="text-ink">{order.buyerName}</span></p>
          <p>{order.buyerPhone}{order.buyerEmail ? ` · ${order.buyerEmail}` : ''}</p>
          <p className="sm:col-span-2">
            {order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ''}, {order.city}, {order.state} {order.pincode}
          </p>
        </div>
      </div>

      {/* Payment */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <ReceiptText className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Payment
        </h2>
        <div className="grid gap-3 font-body text-sm text-ink-soft sm:grid-cols-2">
          <p>Method: <span className="text-ink">{order.paymentMethod.toUpperCase()}</span></p>
          {order.paymentMethod === 'online' && (
            <>
              <p>Status: <span className="text-ink">{order.paymentStatus ?? 'pending'}</span></p>
              <p>Total: <span className="text-ink">₹{payment.total.toLocaleString('en-IN')}</span></p>
              {payment.refundedAmount > 0 && (
                <p>Refunded: <span className="text-ink">₹{payment.refundedAmount.toLocaleString('en-IN')}</span></p>
              )}
              {order.razorpayPaymentId && <p className="truncate">Payment ID: <span className="text-ink">{order.razorpayPaymentId}</span></p>}
              {order.razorpayOrderId && <p className="truncate">Razorpay order: <span className="text-ink">{order.razorpayOrderId}</span></p>}
            </>
          )}
        </div>

        {canRefund && payment.refundable && payment.remainingRefundable > 0 && !refundOpen && (
          <button onClick={() => { setRefundOpen(true); setRefundAmount(String(payment.remainingRefundable)); }} className={buttonStyles('secondary', 'sm', 'w-fit')}>
            Refund buyer
          </button>
        )}

        {refundOpen && (
          <div className="flex flex-col gap-3 rounded-xl bg-ivory-deep/60 p-4">
            {payment.payoutWarning && (
              <p className="flex items-start gap-2 rounded-lg bg-gold/15 px-3 py-2 font-body text-xs text-ink">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-0.5" strokeWidth={2} />
                {payment.payoutWarning}
              </p>
            )}
            <div className="flex flex-col gap-1.5 sm:w-48">
              <label className="font-body text-xs font-medium text-ink-soft">Amount to refund (₹)</label>
              <input
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value.replace(/[^\d.]/g, ''))}
                className={inputStyles}
              />
              <p className="font-body text-xs text-ink-soft">Up to ₹{payment.remainingRefundable.toLocaleString('en-IN')}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-body text-xs font-medium text-ink-soft">Reason</label>
              <input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Item damaged on arrival"
                className={inputStyles}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={submitRefund} disabled={busy} className={buttonStyles('primary', 'sm')}>
                {busy ? 'Processing…' : 'Confirm refund'}
              </button>
              <button onClick={() => setRefundOpen(false)} className={buttonStyles('secondary', 'sm')}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {refunds.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-ink-soft/10 pt-3">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">Refund history</p>
            {refunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-ivory-deep/40 px-3 py-2 font-body text-xs">
                <div>
                  <p className="text-ink">₹{Number(r.amount).toLocaleString('en-IN')} — {r.reason}</p>
                  <p className="text-ink-soft">{new Date(r.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <span className={`rounded-full px-2 py-1 font-semibold ${r.status === 'processed' ? 'bg-teal/10 text-teal-deep' : r.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-gold/15 text-gold-soft'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items by seller */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <Package className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Items
          </h2>
          {canRefund && order.status !== 'cancelled' && items.some((i) => canCancelItem(i.status)) && (
            <button
              onClick={() =>
                setSelectedForCancel(new Set(items.filter((i) => canCancelItem(i.status)).map((i) => i.id)))
              }
              className="font-body text-xs font-medium text-ink-soft underline hover:text-navy"
            >
              Select all (cancel whole order)
            </button>
          )}
        </div>
        {Array.from(itemsBySeller.entries()).map(([sellerId, group]) => (
          <div key={sellerId} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
            <Link href={`/admin/sellers/${sellerId}`} className="font-body text-xs font-semibold text-navy hover:underline">
              {group.businessName ?? `Seller #${sellerId}`}
            </Link>
            {group.items.map((item) => {
              const next = nextStage(item.status);
              const cancellable = canRefund && order.status !== 'cancelled' && canCancelItem(item.status);
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ivory-deep/40 p-3">
                  <div className="flex items-start gap-2.5 font-body text-sm">
                    {cancellable && (
                      <input
                        type="checkbox"
                        checked={selectedForCancel.has(item.id)}
                        onChange={() => toggleCancelSelection(item.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-ink-soft/30 text-navy focus:ring-navy/40"
                        aria-label={`Select ${item.title} to cancel`}
                      />
                    )}
                    <div>
                      <p className="text-ink">
                        {item.title}{item.variantName && ` — ${item.variantName}`} × {item.quantity}
                      </p>
                      <p className="text-xs text-ink-soft">₹{(Number(item.unitPrice) * item.quantity).toLocaleString('en-IN')}</p>
                      {item.status === 'cancelled' && item.cancelledReason && (
                        <p className="mt-0.5 text-xs text-red-600">Cancelled: {item.cancelledReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${
                        item.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-white text-ink-soft ring-1 ring-ink-soft/10'
                      }`}
                    >
                      {ORDER_ITEM_STATUS_LABEL[item.status]}
                    </span>
                    {order.status !== 'cancelled' && next && (
                      <button
                        onClick={() => advanceItem(item.id, next)}
                        disabled={busy}
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
        ))}

        {canRefund && selectedForCancel.size > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gold/30">
            <p className="font-body text-sm font-semibold text-ink">
              Cancel {selectedForCancel.size} item{selectedForCancel.size === 1 ? '' : 's'}
              {order.paymentMethod === 'online' && ' and refund their amount'}
            </p>
            <p className="font-body text-xs text-ink-soft">
              {order.paymentMethod === 'online'
                ? 'The items\' combined price (plus a seller\'s shipping charge too, if this cancels her whole share) is refunded automatically to the buyer\'s original payment method — no separate confirm step.'
                : 'This is Cash on Delivery — nothing was charged online, so cancelling just marks these items as cancelled.'}
            </p>
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why are these being cancelled? (e.g. Out of stock, buyer requested)"
              className={inputStyles}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={submitCancelItems} disabled={cancelling} className={buttonStyles('primary', 'sm')}>
                {cancelling ? 'Cancelling…' : order.paymentMethod === 'online' ? 'Cancel & refund' : 'Cancel item(s)'}
              </button>
              <button onClick={() => setSelectedForCancel(new Set())} className={buttonStyles('secondary', 'sm')}>
                Clear selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shipments */}
      {shipments.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <ShoppingBag className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Shipments
          </h2>
          {shipments.map((s, i) => (
            <div key={i} className="flex items-center justify-between font-body text-sm text-ink-soft">
              <span>{s.businessName ?? `Seller #${s.sellerId}`} — {s.method === 'self_managed' ? 'Self-managed' : 'Delhivery'}</span>
              <span>{s.charge ? `₹${Number(s.charge).toLocaleString('en-IN')}` : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Payouts */}
      {payouts.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <Landmark className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Seller payouts for this order
          </h2>
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between font-body text-sm">
              <Link href={`/admin/sellers/${p.sellerId}`} className="text-ink-soft hover:text-navy hover:underline">
                {p.businessName ?? `Seller #${p.sellerId}`}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-ink">₹{Number(p.netAmount).toLocaleString('en-IN')}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PAYOUT_STATUS_CLASS[p.status]}`}>
                  {PAYOUT_STATUS_LABEL[p.status]}{p.channel ? ` (${p.channel === 'manual' ? 'manual' : 'RazorpayX'})` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disputes */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
            <Flag className="h-4 w-4 text-ink-soft" strokeWidth={2} />
            Disputes
          </h2>
          {!disputes.some((d) => d.status !== 'resolved') && !disputeOpen && (
            <button onClick={() => setDisputeOpen(true)} className={buttonStyles('secondary', 'sm')}>
              Flag a dispute
            </button>
          )}
        </div>

        {disputeOpen && (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gold/30">
            <label className="font-body text-xs font-medium text-ink-soft">What&apos;s the issue?</label>
            <input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className={inputStyles} autoFocus />
            <div className="flex gap-2">
              <button onClick={submitDispute} disabled={busy} className={buttonStyles('primary', 'sm')}>
                {busy ? 'Opening…' : 'Open dispute'}
              </button>
              <button onClick={() => setDisputeOpen(false)} className={buttonStyles('secondary', 'sm')}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {disputes.length === 0 && !disputeOpen ? (
          <p className="rounded-2xl bg-white p-4 font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
            No disputes on this order.
          </p>
        ) : (
          disputes.map((d) => {
            const Icon = DISPUTE_STATUS_ICON[d.status];
            return (
              <div key={d.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold ${DISPUTE_STATUS_CLASS[d.status]}`}>
                    <Icon className="h-3 w-3" strokeWidth={2} />
                    {DISPUTE_STATUS_LABEL[d.status]}
                  </span>
                  <span className="font-body text-xs text-ink-soft">
                    {d.assignedToStaffId
                      ? `Assigned: ${staff.find((s) => s.id === d.assignedToStaffId)?.name ?? staff.find((s) => s.id === d.assignedToStaffId)?.email ?? `#${d.assignedToStaffId}`}`
                      : 'Unassigned'}
                  </span>
                </div>
                <p className="font-body text-sm text-ink">{d.reason}</p>

                {d.status !== 'resolved' && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-ink-soft/10 pt-3">
                    <select
                      value={d.assignedToStaffId ?? ''}
                      onChange={(e) => updateDispute(d.id, { assignedToStaffId: e.target.value ? Number(e.target.value) : null })}
                      className={`${inputStyles} w-auto py-1.5 text-xs`}
                    >
                      <option value="">Assign to…</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
                      ))}
                    </select>
                    {d.status === 'open' && (
                      <button onClick={() => updateDispute(d.id, { status: 'investigating' })} disabled={busy} className={buttonStyles('secondary', 'sm')}>
                        Start investigating
                      </button>
                    )}
                    <button onClick={() => updateDispute(d.id, { status: 'resolved' })} disabled={busy} className={buttonStyles('secondary', 'sm')}>
                      Mark resolved
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <input
                    value={disputeNoteDrafts[d.id] ?? ''}
                    onChange={(e) => setDisputeNoteDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    placeholder="Add a note…"
                    className={`${inputStyles} text-xs`}
                  />
                  <button
                    onClick={() => updateDispute(d.id, { note: disputeNoteDrafts[d.id] })}
                    disabled={busy || !(disputeNoteDrafts[d.id] ?? '').trim()}
                    className={buttonStyles('secondary', 'sm', 'w-fit')}
                  >
                    Add note
                  </button>
                </div>

                {d.comments.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-ink-soft/10 pt-2">
                    {d.comments.map((c) => (
                      <p key={c.id} className="font-body text-xs text-ink-soft">
                        <span className="font-medium text-ink">{c.staffName ?? c.staffEmail ?? 'Staff'}</span>
                        {c.statusChangedTo && ` moved this to ${DISPUTE_STATUS_LABEL[c.statusChangedTo]}`}
                        {c.note && `: ${c.note}`}
                        {' · '}
                        {new Date(c.createdAt).toLocaleString('en-IN')}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!canRefund && (
        <p className="flex items-center gap-1.5 font-body text-xs text-ink-soft">
          <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
          Only Admin/Super Admin can refund a buyer — Customer Support can see everything here and manage disputes.
        </p>
      )}
    </div>
  );
}
