'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { buttonStyles, BOX_SHAPE_CLASS, type ButtonSize } from '@/lib/button-styles';
import { authFetch, getAuthToken } from '@/lib/session-client';

/**
 * FR-5's real contact mechanism: a direct WhatsApp deep link to the
 * seller's own number, opened by the buyer herself — no relay, no name
 * form. WhatsApp Connect & Lead — Meta Direct (Tier 3, item 19,
 * 2026-09-06) made this the finalized design's billable "Connect" event
 * — registered-buyers-only now (session-gated, same as the general
 * contact-model rule in webohra-site/CLAUDE.md), which is also what let
 * the old "type your name" modal go away entirely: her account name is
 * used automatically, and the finalized design explicitly calls for "no
 * form" here — tap, WhatsApp opens instantly. A logged-out tap goes
 * straight to /login instead, same pattern as components/wishlist-button.
 * Also the Silver-tier mechanism for a service listing (service
 * contact-tiering, 2026-09-03 — see components/service-contact-action.tsx)
 * — variantId is only ever passed by that path, a product Add-to-Cart-
 * adjacent listing never has a reason to.
 */
export function WhatsAppBuyButton({
  listingId,
  variantId,
  size = 'sm',
  label = 'Buy on WhatsApp',
  width = 'full',
  shape = 'pill',
}: {
  listingId: number;
  variantId?: number;
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!getAuthToken()) {
      router.push(`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`);
      return;
    }

    setBusy(true);
    try {
      const res = await authFetch(`/api/listings/${listingId}/whatsapp-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(variantId && { variantId }) }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rare path (listing gone, wallet-blocked, etc.) — no toast
        // infrastructure exists on the public site, and a native alert
        // costs nothing here versus building one just for this edge case.
        alert(data.error ?? 'Could not open WhatsApp. Please try again.');
        return;
      }
      const digits = data.sellerPhone.replace(/\D/g, '');
      const waNumber = digits.length === 10 ? `91${digits}` : digits;
      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(data.message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const WIDTH_CLASS = { full: 'w-full', share: 'flex-1', auto: '' } as const;

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={buttonStyles(
        'whatsapp',
        size,
        `${WIDTH_CLASS[width]} ${shape === 'box' ? BOX_SHAPE_CLASS : ''}`,
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
      {busy ? 'Opening…' : label}
    </button>
  );
}
