'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, X, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';
import { useSellerPortal } from '@/lib/seller-context';

type Status = 'initiated' | 'viewed' | 'accepted' | 'rejected' | 'completed' | 'auto_closed_no_update';

type Enquiry = {
  id: number;
  requestNumber: string;
  buyerName: string;
  buyerPhone: string;
  message: string | null;
  status: Status;
  createdAt: string;
  viewedAt: string | null;
  respondedAt: string | null;
  rejectionReason: string | null;
  listingId: number;
  listingTitle: string;
};

const STATUS_LABEL: Record<Status, string> = {
  initiated: 'New',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
  auto_closed_no_update: 'Auto-closed',
};
const STATUS_CLASS: Record<Status, string> = {
  initiated: 'bg-gold/20 text-ink',
  viewed: 'bg-navy/10 text-navy',
  accepted: 'bg-teal/10 text-teal-deep',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-teal/10 text-teal-deep',
  auto_closed_no_update: 'bg-ink-soft/10 text-ink-soft',
};

const TABS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'initiated', label: 'New' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

export default function SellerEnquiriesPage() {
  const { refreshUnread } = useSellerPortal();
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [tab, setTab] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<Enquiry | null>(null);

  async function fetchEnquiries(showLoading: boolean) {
    if (showLoading) setEnquiries(null);
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    const res = await authFetch(`/api/sellers/enquiries?${params}`);
    const data = await res.json();
    setEnquiries(data.enquiries ?? []);
  }

  function load() {
    return fetchEnquiries(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    // No push/websocket infra exists, so this is a plain poll — a new
    // request arriving while she's already parked on this page shouldn't
    // need a manual reload to show up. `false` here skips the loading
    // skeleton so a background refresh doesn't flash the list away.
    const interval = setInterval(() => fetchEnquiries(false), 15_000);
    function onVisible() {
      if (document.visibilityState === 'visible') fetchEnquiries(false);
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function openDetail(enquiry: Enquiry) {
    setSelected(enquiry);
    if (enquiry.status === 'initiated') {
      const res = await authFetch(`/api/sellers/enquiries/${enquiry.id}/view`, { method: 'PATCH' });
      const data = await res.json();
      setSelected(data.enquiry);
      setEnquiries((prev) => prev?.map((e) => (e.id === enquiry.id ? data.enquiry : e)) ?? null);
      // The bell badge counts 'initiated' (unviewed) requests — this just
      // took one off that count, so refresh it now instead of waiting out
      // the shared poll interval.
      refreshUnread();
    }
  }

  function handleUpdated(updated: Enquiry) {
    setSelected(updated);
    setEnquiries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Enquiries</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Take Consultation requests from customers. Connect on WhatsApp to accept, or decline.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
              tab === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {enquiries === null ? (
        <RowListSkeleton count={4} withIcon={false} />
      ) : enquiries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <MessageSquare className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No requests here yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {enquiries.map((e) => (
            <button
              key={e.id}
              onClick={() => openDetail(e)}
              className="flex flex-col gap-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-ink-soft/5 transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold text-ink">
                  {e.buyerName} <span className="font-normal text-ink-soft">· {e.listingTitle}</span>
                </p>
                <p className="truncate font-body text-xs text-ink-soft">
                  {e.message || 'No message'} · {new Date(e.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>
              <span className={`shrink-0 self-start rounded-full px-2.5 py-1 font-body text-xs font-semibold sm:self-auto ${STATUS_CLASS[e.status]}`}>
                {STATUS_LABEL[e.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <EnquiryDetailModal enquiry={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}

function EnquiryDetailModal({
  enquiry,
  onClose,
  onUpdated,
}: {
  enquiry: Enquiry;
  onClose: () => void;
  onUpdated: (e: Enquiry) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/sellers/enquiries/${enquiry.id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not accept this request.');
        return;
      }
      const digits = data.buyerPhone.replace(/\D/g, '');
      const waNumber = digits.length === 10 ? `91${digits}` : digits;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(data.message)}`, '_blank', 'noopener,noreferrer');
      onUpdated({ ...enquiry, status: 'accepted', respondedAt: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/sellers/enquiries/${enquiry.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not reject this request.');
        return;
      }
      onUpdated(data.enquiry);
    } finally {
      setBusy(false);
    }
  }

  const isOpen = enquiry.status === 'initiated' || enquiry.status === 'viewed';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">{enquiry.buyerName}</h2>
            <p className="font-body text-xs text-ink-soft">
              {enquiry.listingTitle} · #{enquiry.requestNumber}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-ivory-deep/60 px-3.5 py-2.5">
          <Phone className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          <span className="font-body text-sm text-ink">{enquiry.buyerPhone}</span>
        </div>

        {enquiry.message && (
          <p className="rounded-xl bg-ivory-deep/60 px-3.5 py-2.5 font-body text-sm text-ink-soft">
            &ldquo;{enquiry.message}&rdquo;
          </p>
        )}

        {enquiry.status === 'rejected' && enquiry.rejectionReason && (
          <p className="font-body text-xs text-red-600">You declined: &ldquo;{enquiry.rejectionReason}&rdquo;</p>
        )}

        {error && <p className="font-body text-sm text-red-700">{error}</p>}

        {isOpen && !rejecting && (
          <>
            <div className="flex flex-col gap-1.5 rounded-xl border border-teal/20 bg-teal/5 p-3">
              <button disabled={busy} onClick={handleAccept} className={buttonStyles('whatsapp', 'md')}>
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                Connect on WhatsApp
              </button>
              <p className="text-center font-body text-[11px] text-ink-soft">
                This opens WhatsApp to message {enquiry.buyerName} directly, and marks the request
                <strong> Accepted</strong>.
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => setRejecting(true)}
              className={buttonStyles('ghost', 'sm', 'text-red-600 hover:text-red-700')}
            >
              <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
              Decline this request
            </button>
          </>
        )}

        {rejecting && (
          <div className="flex flex-col gap-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason (optional, shown to the customer)"
              className="resize-none rounded-xl border border-ink-soft/20 px-3.5 py-2.5 font-body text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <div className="flex gap-2">
              <button disabled={busy} onClick={handleReject} className={buttonStyles('secondary', 'sm', 'flex-1 text-red-600')}>
                {busy ? 'Declining…' : 'Confirm decline'}
              </button>
              <button onClick={() => setRejecting(false)} className={buttonStyles('ghost', 'sm')}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {enquiry.status === 'accepted' && (
          <button disabled={busy} onClick={handleAccept} className={buttonStyles('whatsapp', 'md')}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
            Message again on WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}
