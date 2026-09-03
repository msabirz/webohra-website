'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MessageCircle, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { buttonStyles, BOX_SHAPE_CLASS, type ButtonSize } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';
import { authFetch, getAuthToken } from '@/lib/session-client';

/**
 * "Take Consultation" — redesigned per the requester's explicit call: this
 * no longer opens WhatsApp for the buyer directly. It submits a trackable
 * request instead — the seller sees it in her Enquiries page (with a bell
 * notification), and SHE is the one who opens WhatsApp to the buyer, which
 * is her acceptance (see the Seller Portal's Enquiries page). Guests can
 * submit too (a deliberate change from the general "guests can't contact a
 * seller" rule — see /api/listings/[idOrSlug]/consultation-request), and
 * everyone gets a request number to track status with, logged in or not.
 */
export function ConsultationRequestButton({
  listingId,
  variantId,
  variantName,
  size = 'sm',
  label = 'Take Consultation',
  width = 'full',
  shape = 'pill',
}: {
  listingId: number;
  /** Set when this button is for one specific type of a variant-based
   *  service (e.g. Mehndi's "Full Bridal" coverage tier). `variantName` is
   *  shown in the request modal so she knows exactly what she's asking
   *  about before sending. */
  variantId?: number;
  variantName?: string;
  size?: ButtonSize;
  label?: string;
  width?: 'full' | 'share' | 'auto';
  shape?: 'pill' | 'box';
}) {
  const [open, setOpen] = useState(false);

  function handleOpen(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  const WIDTH_CLASS = { full: 'w-full', share: 'flex-1', auto: '' } as const;

  return (
    <>
      <button
        onClick={handleOpen}
        className={buttonStyles(
          'whatsapp',
          size,
          `${WIDTH_CLASS[width]} ${shape === 'box' ? BOX_SHAPE_CLASS : ''}`,
        )}
      >
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </button>
      {open && (
        <ConsultationRequestModal
          listingId={listingId}
          variantId={variantId}
          variantName={variantName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConsultationRequestModal({
  listingId,
  variantId,
  variantName,
  onClose,
}: {
  listingId: number;
  variantId?: number;
  variantName?: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const isLoggedIn = !!getAuthToken();

  useEffect(() => {
    if (!isLoggedIn) return;
    authFetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.name) setName(data.user.name);
        if (data?.user?.phone) setPhone(data.user.phone);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/consultation-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          ...(variantId && { variantId }),
          buyerName: name,
          buyerPhone: phone,
          message: message || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send your request. Please try again.');
        return;
      }
      setRequestNumber(data.requestNumber);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Portal'd to document.body — this button often sits inside a listing
  // card that applies a hover `transform` (see components/listing-card.tsx),
  // and a `fixed`-positioned descendant of a transformed ancestor stops
  // being positioned relative to the viewport at all — it repositions
  // relative to that ancestor instead. Since the modal covers the card, the
  // card immediately stops being "hovered", the transform un-applies, the
  // modal jumps again, and so on: a rapid open/close-looking flicker.
  // Portaling to <body> — a guaranteed untransformed ancestor — is the same
  // fix already used for components/account-menu.tsx and
  // components/seller/notification-bell.tsx.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      {requestNumber ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-2xl ring-1 ring-black/5"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10">
            <CheckCircle2 className="h-6 w-6 text-teal-deep" strokeWidth={1.75} />
          </span>
          <h2 className="font-heading text-lg font-semibold text-ink">Request sent</h2>
          <p className="font-body text-sm text-ink-soft">
            The seller has been notified. She&apos;ll reach out to you on WhatsApp once she accepts.
          </p>
          <p className="rounded-xl bg-ivory-deep px-4 py-2.5 font-body text-sm font-semibold text-ink">
            #{requestNumber}
          </p>
          <p className="font-body text-xs text-ink-soft">
            {isLoggedIn
              ? 'Track it anytime under My Requests in your account, or with this number.'
              : 'Save this number to track your request — you won\'t be asked to sign in.'}
          </p>
          <Link
            href={`/request/${requestNumber}`}
            className={buttonStyles('primary', 'md', 'w-full')}
          >
            Track this request
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
          <button onClick={onClose} className="font-body text-sm text-ink-soft hover:text-ink hover:underline">
            Close
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10">
                <MessageCircle className="h-4.5 w-4.5 text-teal-deep" strokeWidth={2} />
              </span>
              <h2 className="font-heading text-lg font-semibold text-ink">Take Consultation</h2>
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
            {variantName ? (
              <>
                About <span className="font-semibold text-ink">{variantName}</span> — the seller
                will reach out to you on WhatsApp once she accepts.
              </>
            ) : (
              'Send a request — the seller will reach out to you on WhatsApp once she accepts.'
            )}
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-name" className="font-body text-sm font-medium text-ink">
              Your name
            </label>
            <input
              id="cr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoFocus
              className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5 font-body text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-phone" className="font-body text-sm font-medium text-ink">
              Your phone
            </label>
            <PhoneInput id="cr-phone" value={phone} onChange={setPhone} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cr-message" className="font-body text-sm font-medium text-ink">
              Message <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              id="cr-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="What would you like to ask about?"
              className="resize-none rounded-xl border border-ink-soft/20 px-3.5 py-2.5 font-body text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>
          {error && <p className="font-body text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className={buttonStyles('whatsapp', 'md')}>
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}
    </div>,
    document.body,
  );
}
