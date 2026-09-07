'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X, Handshake } from 'lucide-react';
import { getStoredLocation } from '@/lib/location-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';

type PickupAddress = { line1: string; line2: string | null; city: string; state: string; pincode: string };

/**
 * Pickup & Pay full redesign (Tier 4, item 22, 2026-09-06) — she picks a
 * date + time and this is now a real "buy now" (POST
 * /api/listings/[idOrSlug]/pickup-order), not a disconnected booking
 * request: a real order/orderItem/shipment row gets created, the first
 * of the two commission stages fires immediately, and she lands on the
 * exact same /order/[orderNumber] page every other order type uses —
 * the old /pickup/[trackingNumber] tracking page is retired for new
 * bookings (see pickupRequests' own schema comment). Still no payment
 * happens here at all — she pays the seller in person when she collects
 * it, exactly as before.
 */
export function PickupRequestModal({
  listingId,
  variantId,
  pickupCity,
  pickupAddress,
  pickupLeadTimeHours,
  onClose,
}: {
  listingId: number;
  /** Set only when this came from ProductVariantPicker's "Order Now" —
   *  see that component's own comment on why it has to carry this. */
  variantId?: number;
  pickupCity: string | null;
  pickupAddress: PickupAddress | null;
  pickupLeadTimeHours: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const leadTimeMs = (pickupLeadTimeHours ?? 0) * 60 * 60 * 1000;
  const earliest = new Date(Date.now() + leadTimeMs);
  const minDate = earliest.toISOString().slice(0, 10);
  // Only meaningful when the picked date is the same as the earliest
  // allowed date — a later date has no time-of-day floor at all.
  const minTimeOnEarliestDate = earliest.toTimeString().slice(0, 5);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/pickup-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          ...(variantId && { variantId }),
          buyerName,
          buyerPhone,
          buyerEmail: buyerEmail || undefined,
          buyerCity: getStoredLocation()?.city ?? '',
          requestedDate,
          requestedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not submit your request. Please try again.');
        return;
      }
      router.push(`/order/${data.orderNumber}`);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15">
              <Handshake className="h-4.5 w-4.5 text-gold" strokeWidth={2} />
            </span>
            <h2 className="font-heading text-lg font-semibold text-ink">Pickup &amp; Pay</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <p className="-mt-2 font-body text-sm text-ink-soft">
          Pick a date and time — you pay the seller in person when you collect it, no shipping
          involved.
        </p>

        <div className="rounded-xl bg-ivory-deep/60 p-3">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">Pickup location</p>
          {pickupAddress ? (
            <p className="mt-1 font-body text-sm text-ink">
              {pickupAddress.line1}
              {pickupAddress.line2 ? `, ${pickupAddress.line2}` : ''}, {pickupAddress.city},{' '}
              {pickupAddress.state} {pickupAddress.pincode}
            </p>
          ) : (
            <p className="mt-1 font-body text-sm text-ink-soft">
              {pickupCity ?? 'City not set yet'} — exact address shared once the seller confirms.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pu-name" className="font-body text-sm font-medium text-ink">
            Your name
          </label>
          <input
            id="pu-name"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            required
            minLength={2}
            className={inputStyles}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pu-phone" className="font-body text-sm font-medium text-ink">
            Phone number
          </label>
          <PhoneInput id="pu-phone" value={buyerPhone} onChange={setBuyerPhone} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pu-email" className="font-body text-sm font-medium text-ink">
            Email <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="pu-email"
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            className={inputStyles}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pu-date" className="font-body text-sm font-medium text-ink">
              Date
            </label>
            <input
              id="pu-date"
              type="date"
              min={minDate}
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              required
              className={inputStyles}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pu-time" className="font-body text-sm font-medium text-ink">
              Time
            </label>
            <input
              id="pu-time"
              type="time"
              min={requestedDate === minDate ? minTimeOnEarliestDate : undefined}
              value={requestedTime}
              onChange={(e) => setRequestedTime(e.target.value)}
              required
              className={inputStyles}
            />
          </div>
        </div>
        {pickupLeadTimeHours ? (
          <p className="-mt-2 font-body text-xs text-ink-soft">
            This seller needs at least {pickupLeadTimeHours} hour{pickupLeadTimeHours === 1 ? '' : 's'}&apos;
            notice.
          </p>
        ) : null}

        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Submitting…' : 'Confirm booking'}
        </button>
      </form>
    </div>
  );
}
