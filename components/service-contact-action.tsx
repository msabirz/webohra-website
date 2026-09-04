'use client';

import { Phone } from 'lucide-react';
import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { ConsultationRequestButton } from '@/components/consultation-request-button';
import { buttonStyles, BOX_SHAPE_CLASS, type ButtonSize } from '@/lib/button-styles';

const WIDTH_CLASS = { full: 'w-full', share: 'flex-1', auto: '' } as const;

/**
 * The one buyer-facing action for reaching a service seller — picks
 * between three real mechanisms based on her ACTIVE plan's contactMode
 * (service contact-tiering, 2026-09-03; see GET /api/listings/[idOrSlug]'s
 * own comment for the full tier story):
 *   - 'whatsapp_number' (Basic): a direct "Call Now" tel: link — only
 *     rendered when the caller supplies `sellerPhone` (2026-09-05, real
 *     bug the user's own screenshot caught: the listing-card grid tile
 *     was left with no action at all for this tier, an empty gap where
 *     every other tier gets a real button). ServiceDetailView's PDP
 *     sidebar already shows her phone as its own tel: link, so that
 *     caller deliberately doesn't pass sellerPhone here — a second,
 *     redundant Call Now button right next to the sidebar would be
 *     noise, not help. The tile has no such sidebar, so it does.
 *   - 'direct_whatsapp' (Silver): reuses WhatsAppBuyButton exactly as a
 *     product's "Contact Seller" already works — opens WhatsApp straight
 *     to her, no relay, no portal notification.
 *   - 'masked_relay' (Gold) — or null, the safe fallback if no plan is
 *     resolved: reuses ConsultationRequestButton exactly as it already
 *     works — a trackable request lands in her Enquiries page, and SHE
 *     opens WhatsApp to connect, her number never shown to the buyer.
 */
export function ServiceContactAction({
  contactMode,
  listingId,
  variantId,
  variantName,
  sellerPhone,
  size = 'sm',
  label,
  width = 'full',
  shape = 'pill',
}: {
  contactMode: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
  listingId: number;
  variantId?: number;
  variantName?: string;
  /** Only ever renders the Call Now button when this is provided — see
   *  the component's own comment on why the PDP deliberately omits it. */
  sellerPhone?: string | null;
  size?: ButtonSize;
  label?: string;
  width?: 'full' | 'share' | 'auto';
  shape?: 'pill' | 'box';
}) {
  if (contactMode === 'whatsapp_number') {
    if (!sellerPhone) return null;
    const digits = sellerPhone.replace(/\D/g, '');
    const telNumber = digits.length === 10 ? `+91${digits}` : `+${digits}`;
    return (
      // A real <a href="tel:..."> would be simpler, but every caller of
      // this component sits inside its own card-level <Link> (ListingCard)
      // or its own <a> elsewhere — a nested <a> inside an <a> is invalid
      // HTML and React correctly raises it as a hydration error (caught
      // 2026-09-05 via a live console check, not just a visual pass).
      // window.location mirrors a real tel: link's actual browser
      // behavior without nesting an anchor.
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = `tel:${telNumber}`;
        }}
        className={buttonStyles(
          'whatsapp',
          size,
          `${WIDTH_CLASS[width]} ${shape === 'box' ? BOX_SHAPE_CLASS : ''}`,
        )}
      >
        <Phone className="h-3.5 w-3.5" strokeWidth={2} />
        {label ?? 'Call Now'}
      </button>
    );
  }

  if (contactMode === 'direct_whatsapp') {
    return (
      <WhatsAppBuyButton
        listingId={listingId}
        variantId={variantId}
        variantName={variantName}
        size={size}
        label={label ?? 'Contact via WhatsApp'}
        width={width}
        shape={shape}
      />
    );
  }

  // 'masked_relay', or null (no active plan resolved) — same safe default
  // as the API's own fallback.
  return (
    <ConsultationRequestButton
      listingId={listingId}
      variantId={variantId}
      variantName={variantName}
      size={size}
      label={label ?? 'Take Consultation'}
      width={width}
      shape={shape}
    />
  );
}
