'use client';

import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { ConsultationRequestButton } from '@/components/consultation-request-button';
import type { ButtonSize } from '@/lib/button-styles';

/**
 * The one buyer-facing action for reaching a service seller — picks
 * between the two real mechanisms based on her ACTIVE plan's contactMode
 * (service contact-tiering, 2026-09-03; see GET /api/listings/[idOrSlug]'s
 * own comment for the full tier story):
 *   - 'direct_whatsapp' (Silver): reuses WhatsAppBuyButton exactly as a
 *     product's "Contact Seller" already works — opens WhatsApp straight
 *     to her, no relay, no portal notification.
 *   - 'masked_relay' (Gold) — or null, the safe fallback if no plan is
 *     resolved: reuses ConsultationRequestButton exactly as it already
 *     works — a trackable request lands in her Enquiries page, and SHE
 *     opens WhatsApp to connect, her number never shown to the buyer.
 *   - 'whatsapp_number' (Basic): renders nothing here at all — that tier
 *     shows her phone/email directly elsewhere on the page (see
 *     ServiceDetailView's own sidebar card), there's no button-triggered
 *     action for it.
 */
export function ServiceContactAction({
  contactMode,
  listingId,
  variantId,
  variantName,
  size = 'sm',
  label,
  width = 'full',
  shape = 'pill',
}: {
  contactMode: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
  listingId: number;
  variantId?: number;
  variantName?: string;
  size?: ButtonSize;
  label?: string;
  width?: 'full' | 'share' | 'auto';
  shape?: 'pill' | 'box';
}) {
  if (contactMode === 'whatsapp_number') return null;

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
