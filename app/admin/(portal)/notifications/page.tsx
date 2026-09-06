'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, MessageSquareText, CheckCircle2, XCircle } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { RowListSkeleton } from '@/components/skeleton';

type Notification = {
  id: number;
  channel: 'email' | 'sms';
  recipient: string;
  subject: string | null;
  body: string;
  event: string;
  relatedId: number | null;
  status: 'sent' | 'failed';
  failureReason: string | null;
  createdAt: string;
};

const EVENT_LABEL: Record<string, string> = {
  order_confirmed: 'Order confirmed',
  payment_received: 'Payment received',
  payment_failed: 'Payment failed',
  shipment_status_changed: 'Shipping update',
  dispute_opened: 'Dispute opened',
  dispute_resolved: 'Dispute resolved',
};

/**
 * Tier 3, item 20 — the audit trail behind Notifications infrastructure.
 * Dev mode only until real MSG91 credentials exist (see
 * lib/notifications/index.ts) — every row here reflects an attempted
 * send, real or console-logged, so it's still useful for confirming the
 * right event fired for the right recipient before going live for real.
 */
export default function AdminNotificationsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [rows, setRows] = useState<Notification[] | null>(null);

  useEffect(() => {
    setRows(null);
    const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    authFetch(`/api/admin/notifications${query}`)
      .then((res) => res.json())
      .then((data) => setRows(data.notifications ?? []));
  }, [statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold text-ink">
            <Bell className="h-6 w-6 text-navy" strokeWidth={1.75} />
            Notifications
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Order confirmations, payment updates, shipping updates, and dispute alerts — every attempted send, most
            recent first.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-ink-soft/5">
          {(['all', 'sent', 'failed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3.5 py-1.5 font-body text-xs font-semibold capitalize transition ${
                statusFilter === s ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <RowListSkeleton count={5} withIcon={false} />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
          Nothing here yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/5">
                {n.channel === 'email' ? (
                  <Mail className="h-4 w-4 text-navy" strokeWidth={1.75} />
                ) : (
                  <MessageSquareText className="h-4 w-4 text-navy" strokeWidth={1.75} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-body text-sm font-medium text-ink">{EVENT_LABEL[n.event] ?? n.event}</p>
                  <span className="rounded-full bg-ivory-deep px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {n.channel}
                  </span>
                  {n.status === 'sent' ? (
                    <span className="flex items-center gap-1 font-body text-[10px] font-semibold text-teal-deep">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                      Sent
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-body text-[10px] font-semibold text-red-600">
                      <XCircle className="h-3 w-3" strokeWidth={2} />
                      Failed
                    </span>
                  )}
                </div>
                <p className="truncate font-body text-xs text-ink-soft">To {n.recipient}</p>
                {n.subject && <p className="truncate font-body text-xs text-ink-soft">{n.subject}</p>}
                {n.failureReason && <p className="font-body text-xs text-red-600">{n.failureReason}</p>}
              </div>
              <span className="shrink-0 font-body text-xs text-ink-soft">
                {new Date(n.createdAt).toLocaleString('en-IN')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
