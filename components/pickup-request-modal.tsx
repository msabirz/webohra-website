'use client';

import { useState, FormEvent } from 'react';
import { X, Handshake } from 'lucide-react';
import { getStoredLocation } from '@/lib/location-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';

/**
 * Pickup & Pay: she picks a date + place, no payment happens here at all —
 * the seller follows up off-platform within 24h and collects payment in
 * person then. See pickupRequests in db/schema.ts for why this replaced an
 * earlier QR/mark-paid design.
 */
export function PickupRequestModal({
  listingId,
  onClose,
}: {
  listingId: number;
  onClose: () => void;
}) {
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedPlace, setRequestedPlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

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
          requestedPlace,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not submit your request. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      {done ? (
        <div className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-7 text-center shadow-2xl ring-1 ring-black/5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
            <Handshake className="h-7 w-7 text-teal-deep" strokeWidth={2} />
          </span>
          <p className="font-heading text-lg font-semibold text-ink">
            Thank you for your interest!
          </p>
          <p className="font-body text-sm text-ink-soft">
            The seller will contact you within 24 hours to confirm your Pickup &amp; Pay.
          </p>
          <button onClick={onClose} className={buttonStyles('primary', 'md', 'mt-2')}>
            Done
          </button>
        </div>
      ) : (
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
            Pick a date and place — the seller will confirm and you pay her in person, no shipping
            involved.
          </p>

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
            <label htmlFor="pu-date" className="font-body text-sm font-medium text-ink">
              Preferred date
            </label>
            <input
              id="pu-date"
              type="date"
              min={today}
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              required
              className={inputStyles}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pu-place" className="font-body text-sm font-medium text-ink">
              Preferred place
            </label>
            <input
              id="pu-place"
              value={requestedPlace}
              onChange={(e) => setRequestedPlace(e.target.value)}
              placeholder="e.g. Saifee Masjid Jamaat, Mumbai"
              required
              minLength={3}
              className={inputStyles}
            />
          </div>

          {error && <p className="font-body text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
            {submitting ? 'Submitting…' : 'Confirm request'}
          </button>
        </form>
      )}
    </div>
  );
}
