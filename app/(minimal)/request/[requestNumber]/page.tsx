'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Package,
} from 'lucide-react';
import { buttonStyles } from '@/lib/button-styles';
import { TrackingPageSkeleton } from '@/components/skeleton';

type RequestStatus = 'initiated' | 'viewed' | 'accepted' | 'rejected' | 'completed' | 'auto_closed_no_update';

type RequestDetail = {
  requestNumber: string;
  buyerName: string;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
  viewedAt: string | null;
  respondedAt: string | null;
  rejectionReason: string | null;
  variantName: string | null;
  listingTitle: string;
  listingSlug: string;
  businessName: string | null;
};

const OPEN_STEPS = [
  { key: 'initiated', icon: Send, label: 'Request sent' },
  { key: 'viewed', icon: Eye, label: 'Seen by seller' },
  { key: 'accepted', icon: CheckCircle2, label: 'Accepted' },
];

const STEP_INDEX: Record<RequestStatus, number> = {
  initiated: 0,
  viewed: 1,
  accepted: 2,
  rejected: 1,
  completed: 2,
  auto_closed_no_update: 1,
};

export default function RequestTrackingPage() {
  const params = useParams<{ requestNumber: string }>();
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/requests/${params.requestNumber}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setReq(data.request);
      })
      .finally(() => setLoading(false));
  }, [params.requestNumber]);

  if (loading) return <TrackingPageSkeleton />;
  if (notFound || !req) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-heading text-xl font-semibold text-ink">Request not found</p>
        <Link href="/" className="font-body text-sm text-navy underline">
          Back to home
        </Link>
      </div>
    );
  }

  const requestDate = new Date(req.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const isRejected = req.status === 'rejected';
  const isClosed = req.status === 'auto_closed_no_update';
  const activeIndex = STEP_INDEX[req.status];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {isRejected ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-red-50 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-600" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">Request declined</h1>
          <p className="font-body text-sm text-ink-soft">#{req.requestNumber}</p>
          {req.rejectionReason && (
            <p className="mt-2 max-w-sm font-body text-sm text-ink-soft">&ldquo;{req.rejectionReason}&rdquo;</p>
          )}
        </div>
      ) : isClosed ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-ivory-deep px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-soft/10">
            <XCircle className="h-8 w-8 text-ink-soft" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">Request closed</h1>
          <p className="font-body text-sm text-ink-soft">
            #{req.requestNumber} — no response after 30 days, so this was automatically closed.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-gradient-to-b from-teal/10 to-transparent px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/15">
            <MessageCircle className="h-8 w-8 text-teal-deep" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">
            Thanks, {req.buyerName}!
          </h1>
          <p className="font-body text-sm text-ink-soft">
            Request #{req.requestNumber} · Sent {requestDate}
          </p>
        </div>
      )}

      {!isRejected && !isClosed && (
        <>
          <div className="relative flex items-start justify-between rounded-2xl bg-white px-4 py-6 shadow-sm ring-1 ring-ink-soft/5">
            <div className="absolute left-[16.5%] right-[16.5%] top-[34px] h-0.5 bg-ink-soft/10" />
            {OPEN_STEPS.map((step, i) => (
              <div key={step.key} className="relative flex flex-1 flex-col items-center gap-2 text-center">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    i <= activeIndex ? 'bg-teal text-ivory' : 'bg-ivory-deep text-ink-soft/50'
                  }`}
                >
                  <step.icon className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <span className="font-body text-[11px] leading-tight text-ink-soft">{step.label}</span>
              </div>
            ))}
          </div>
          {req.status === 'accepted' && (
            <p className="text-center font-body text-xs text-ink-soft">
              The seller has accepted and will message you on WhatsApp directly.
            </p>
          )}
        </>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <Package className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Consultation
        </h2>
        <p className="font-body text-sm text-ink">
          {req.listingTitle}
          {req.variantName && ` — ${req.variantName}`}
        </p>
        {req.businessName && <p className="font-body text-xs text-ink-soft">by {req.businessName}</p>}
        {req.message && (
          <p className="mt-2 rounded-lg bg-ivory-deep px-3 py-2 font-body text-xs text-ink-soft">
            &ldquo;{req.message}&rdquo;
          </p>
        )}
        <p className="mt-3 font-body text-xs text-ink-soft">
          Track this request anytime using #{req.requestNumber} from the site footer.
        </p>
      </div>

      <Link href={`/collection/${req.listingSlug}`} className={buttonStyles('secondary', 'md')}>
        View the collection
      </Link>
      <Link href="/" className={buttonStyles('primary', 'lg')}>
        Continue browsing
      </Link>
    </div>
  );
}
