'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Handshake, MapPin, AlertTriangle } from 'lucide-react';
import { buttonStyles } from '@/lib/button-styles';
import { TrackingPageSkeleton } from '@/components/skeleton';

type PickupStatus = 'pending' | 'received' | 'issue';

type PickupDetail = {
  trackingNumber: string;
  buyerName: string;
  requestedDate: string;
  requestedTime: string | null;
  status: PickupStatus;
  readyForPickup: boolean;
  listingTitle: string;
  listingSlug: string;
  businessName: string | null;
  place: string | null;
};

export default function PickupTrackingPage() {
  const params = useParams<{ trackingNumber: string }>();
  const [req, setReq] = useState<PickupDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pickup-requests/${params.trackingNumber}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setReq(data.request);
      })
      .finally(() => setLoading(false));
  }, [params.trackingNumber]);

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

  const requestDate = new Date(req.requestedDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const isIssue = req.status === 'issue';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {isIssue ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-red-50 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">There&apos;s an issue with this pickup</h1>
          <p className="font-body text-sm text-ink-soft">
            #{req.trackingNumber} · Our team is following up with the seller.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-gradient-to-b from-gold/10 to-transparent px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/15">
            <Handshake className="h-8 w-8 text-gold" strokeWidth={1.75} />
          </span>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-ink">Thanks, {req.buyerName}!</h1>
          <p className="font-body text-sm text-ink-soft">
            Pickup request #{req.trackingNumber} · Requested {requestDate}
            {req.requestedTime && ` at ${req.requestedTime}`}
          </p>
          <p className="mt-1 font-body text-sm text-ink-soft">
            {req.businessName ?? 'The seller'} will confirm within 24 hours — no payment happens here, you
            pay her directly when you collect.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <MapPin className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Pickup location
        </h2>
        {req.place ? (
          <p className="font-body text-sm text-ink-soft">{req.place}</p>
        ) : (
          <p className="font-body text-sm text-ink-soft">
            The exact pickup location will be shared once {req.businessName ?? 'the seller'} confirms your
            request.
          </p>
        )}
        <p className="mt-3 font-body text-xs text-ink-soft">
          Track this request anytime using #{req.trackingNumber} from the site footer.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <p className="font-body text-sm text-ink">{req.listingTitle}</p>
        {req.businessName && <p className="font-body text-xs text-ink-soft">by {req.businessName}</p>}
      </div>

      <Link href={`/collection/${req.listingSlug}`} className={buttonStyles('secondary', 'md')}>
        View the listing
      </Link>
      <Link href="/" className={buttonStyles('primary', 'lg')}>
        Continue browsing
      </Link>
    </div>
  );
}
