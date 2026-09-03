'use client';

import { Package } from 'lucide-react';
import { ServiceContactAction } from '@/components/service-contact-action';

export type Variant = {
  id: number;
  name: string;
  price: string;
  stockQuantity: number | null;
  images: { id: number; url: string }[];
};

/**
 * The buyer-facing menu for a variant-based SERVICE listing — each type
 * its own card (photo, name, price, own contact action), not a
 * single-select "pick one" picker. Deliberate: a buyer choosing between a
 * Mehndi listing's coverage tiers, or similar, may reasonably want to see
 * every option's own contact action side by side.
 *
 * Product-side variant listings moved off this component entirely
 * (2026-09-03 PDP redesign, user-approved mockup) to
 * components/product-variant-picker.tsx — a single-select photo-swatch
 * picker instead, since a product variant is a style/color choice (buy
 * one at a time), not several genuinely different things a buyer might
 * combine in one order. This component is service-only now; the dropped
 * ProductVariantCard/isService branch lived here before that split.
 */
export function VariantMenu({
  listingId,
  variants,
  contactMode,
}: {
  listingId: number;
  variants: Variant[];
  contactMode: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {variants.map((variant) => (
        <ServiceVariantCard key={variant.id} listingId={listingId} variant={variant} contactMode={contactMode} />
      ))}
    </div>
  );
}

function VariantPhoto({ variant }: { variant: Variant }) {
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ivory-deep">
      {variant.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
        <img src={variant.images[0].url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Package className="h-6 w-6 text-ink-soft/30" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

function ServiceVariantCard({
  listingId,
  variant,
  contactMode,
}: {
  listingId: number;
  variant: Variant;
  contactMode: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-soft/5">
      <VariantPhoto variant={variant} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-ink">{variant.name}</p>
        <p className="font-heading text-base font-semibold text-navy">
          ₹{Number(variant.price).toLocaleString('en-IN')}
        </p>
      </div>
      <ServiceContactAction
        contactMode={contactMode}
        listingId={listingId}
        variantId={variant.id}
        variantName={variant.name}
        size="sm"
        width="auto"
      />
    </div>
  );
}
