'use client';

import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { buttonStyles, BOX_SHAPE_CLASS, type ButtonSize } from '@/lib/button-styles';

/**
 * FR-5's real contact mechanism: a direct WhatsApp deep link to the seller's
 * own number, opened by the buyer herself — no relay. Asks for a name first
 * (no buyer-account system stores one) so the pre-filled message can
 * identify who's asking, and logs the click server-side — see
 * /api/listings/[id]/whatsapp-contact. Also the Silver-tier mechanism for a
 * service listing (service contact-tiering, 2026-09-03 — see
 * components/service-contact-action.tsx) — variantId/variantName are only
 * ever passed by that path, a product Add-to-Cart-adjacent listing never
 * has a reason to.
 */
export function WhatsAppBuyButton({
  listingId,
  variantId,
  variantName,
  size = 'sm',
  label = 'Buy on WhatsApp',
  width = 'full',
  shape = 'pill',
}: {
  listingId: number;
  variantId?: number;
  variantName?: string;
  size?: ButtonSize;
  label?: string;
  /** 'full' fills its container alone; 'share' takes an equal split of a
   *  flex row (used when sitting side-by-side with Add to Cart); 'auto'
   *  sizes to content (standalone hero CTAs, e.g. ServiceDetailView). */
  width?: 'full' | 'share' | 'auto';
  /** 'box' swaps the default pill for a softly-rounded rectangle — used
   *  where this sits side-by-side with Add to Cart on a listing tile. */
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
        <WhatsAppNameModal
          listingId={listingId}
          variantId={variantId}
          variantName={variantName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function WhatsAppNameModal({
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/whatsapp-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerName: name, ...(variantId && { variantId }) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not open WhatsApp. Please try again.');
        return;
      }
      const digits = data.sellerPhone.replace(/\D/g, '');
      const waNumber = digits.length === 10 ? `91${digits}` : digits;
      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(data.message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Portal'd to document.body — see the identical comment in
  // components/consultation-request-button.tsx: this button sits inside a
  // listing card with a hover `transform`, which would otherwise make this
  // `fixed`-positioned modal reposition relative to the card instead of the
  // viewport and flicker as the card's hover state fights with the modal
  // covering it.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
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
            <h2 className="font-heading text-lg font-semibold text-ink">Message the seller</h2>
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
              About <span className="font-semibold text-ink">{variantName}</span> — this opens WhatsApp
              with your message pre-filled, you send it yourself.
            </>
          ) : (
            'This opens WhatsApp with your message pre-filled — you send it yourself.'
          )}
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wa-name" className="font-body text-sm font-medium text-ink">
            Your name
          </label>
          <input
            id="wa-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            autoFocus
            className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5 font-body text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('whatsapp', 'md')}>
          {submitting ? 'Opening…' : 'Continue to WhatsApp'}
        </button>
      </form>
    </div>,
    document.body,
  );
}
