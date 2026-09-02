'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X, Handshake } from 'lucide-react';
import { getStoredLocation } from '@/lib/location-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';

type PickupAddress = { line1: string; line2: string | null; city: string; state: string; pincode: string };

/**
 * Pickup & Pay: she picks a date + time, no payment happens here at all —
 * the seller follows up off-platform within 24h and collects payment in
 * person then. Fulfillment & Subscriptions redesign, Phase 3: "place" is no
 * longer buyer-entered free text — it's resolved server-side from the
 * listing's own pickup location (shown here only when the seller has
 * opted this listing into showing it up front; otherwise just the city,
 * same reveal rule the PDP itself applies) — and the slot picker respects
 * her minimum-notice window rather than accepting any future date blindly.
 */
export function PickupRequestModal({
  listingId,
  pickupCity,
  pickupAddress,
  pickupLeadTimeHours,
  onClose,
}: {
  listingId: number;
  pickupCity: string | null;
  pickupAddress: PickupAddress | null;
  pickupLeadTimeHours: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
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
      const res = await fetch('/api/pickup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          buyerName,
          buyerPhone,
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
      router.push(`/pickup/${data.pickupRequest.trackingNumber}`);
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
          Pick a date and time — the seller will confirm and you pay her in person, no shipping
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
          {submitting ? 'Submitting…' : 'Confirm request'}
        </button>
      </form>
    </div>
  );
}
