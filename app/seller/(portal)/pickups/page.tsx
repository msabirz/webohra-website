'use client';

import { useEffect, useState } from 'react';
import { Handshake, MapPin, Phone, CheckCircle2 } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type Pickup = {
  id: number;
  trackingNumber: string;
  buyerName: string;
  buyerPhone: string;
  requestedDate: string;
  requestedTime: string | null;
  requestedPlace: string;
  status: 'pending' | 'received' | 'issue';
  readyForPickupAt: string | null;
  listingId: number;
  listingTitle: string;
};

/**
 * /seller/pickups — her own Pickup & Pay requests, with "Mark ready for
 * pickup" (planning doc Decision 5's other address-reveal trigger,
 * alongside a listing's showAddressOnPdp toggle) — didn't exist before
 * this: sellers previously had no in-app view of these requests at all,
 * only Admin did.
 */
export default function SellerPickupsPage() {
  const [pickups, setPickups] = useState<Pickup[] | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  async function load() {
    const res = await authFetch('/api/sellers/pickup-requests');
    const data = await res.json();
    setPickups(data.pickups ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markReady(pickup: Pickup) {
    setMarkingId(pickup.id);
    try {
      const res = await authFetch(`/api/sellers/pickup-requests/${pickup.id}`, { method: 'PATCH' });
      const data = await res.json();
      // Merge just the field that actually changed rather than replacing
      // the whole row — the PATCH response is the raw pickup_requests row
      // with no listing join, so swapping it in wholesale silently dropped
      // listingTitle (and would drop anything else joined-in) until the
      // next full reload.
      if (res.ok) {
        setPickups(
          (prev) => prev?.map((p) => (p.id === pickup.id ? { ...p, readyForPickupAt: data.pickup.readyForPickupAt } : p)) ?? null,
        );
      }
    } finally {
      setMarkingId(null);
    }
  }

  const requestDate = (p: Pickup) =>
    new Date(p.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    (p.requestedTime ? ` at ${p.requestedTime}` : '');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Pickups</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Pickup &amp; Pay requests for your listings. Mark one ready once you&apos;ve confirmed with
          the buyer — that&apos;s what shows her the exact pickup address on her own tracking page,
          for listings where you&apos;ve kept it private up front.
        </p>
      </div>

      {pickups === null ? (
        <RowListSkeleton count={3} withIcon={false} />
      ) : pickups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Handshake className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No Pickup &amp; Pay requests yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pickups.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-semibold text-ink">
                  {p.buyerName} <span className="font-normal text-ink-soft">· {p.listingTitle}</span>
                </p>
                <p className="mt-0.5 font-body text-xs text-ink-soft">
                  {requestDate(p)} · #{p.trackingNumber}
                </p>
                <div className="mt-2 flex items-center gap-1.5 font-body text-xs text-ink-soft">
                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  {p.buyerPhone}
                </div>
                <div className="mt-1 flex items-start gap-1.5 font-body text-xs text-ink-soft">
                  <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  {p.requestedPlace}
                </div>
              </div>
              <div className="shrink-0">
                {p.readyForPickupAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-3 py-1.5 font-body text-xs font-semibold text-teal-deep">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Ready — address visible to buyer
                  </span>
                ) : (
                  <button
                    disabled={markingId === p.id}
                    onClick={() => markReady(p)}
                    className={buttonStyles('accent', 'sm')}
                  >
                    {markingId === p.id ? 'Marking…' : 'Mark ready for pickup'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
