'use client';

import { useState } from 'react';
import { Package, Minus, Plus, Check, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/cart-context';
import { ServiceContactAction } from '@/components/service-contact-action';
import { buttonStyles } from '@/lib/button-styles';

export type Variant = {
  id: number;
  name: string;
  price: string;
  stockQuantity: number | null;
  images: { id: number; url: string }[];
};

/**
 * The buyer-facing menu for a variant-based listing — each type its own
 * card (photo, name, price, own action), not a single-select "pick one,
 * then buy" picker. Deliberate: a buyer choosing between Roti's types may
 * reasonably want 2 Manda + 1 Butter Naan in the same order, which a
 * radio-style picker can't express. Shared between the product PDP (own
 * Add to Cart per card) and the service SDP (own Take Consultation per
 * card) — same layout, different action.
 */
export function VariantMenu({
  listingId,
  variants,
  isService,
  contactMode,
}: {
  listingId: number;
  variants: Variant[];
  isService: boolean;
  /** Only meaningful when isService — see components/service-contact-action.tsx. */
  contactMode?: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {variants.map((variant) =>
        isService ? (
          <ServiceVariantCard key={variant.id} listingId={listingId} variant={variant} contactMode={contactMode ?? null} />
        ) : (
          <ProductVariantCard key={variant.id} listingId={listingId} variant={variant} />
        ),
      )}
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

function ProductVariantCard({ listingId, variant }: { listingId: number; variant: Variant }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = variant.stockQuantity === 0;

  function handleAdd() {
    addItem(listingId, quantity, variant.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-soft/5">
      <VariantPhoto variant={variant} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-ink">{variant.name}</p>
        <p className="font-heading text-base font-semibold text-navy">
          ₹{Number(variant.price).toLocaleString('en-IN')}
        </p>
        {outOfStock && <p className="font-body text-xs text-red-600">Out of stock</p>}
      </div>
      {!outOfStock && (
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-ink-soft/20 p-0.5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep"
              aria-label={`Decrease ${variant.name} quantity`}
            >
              <Minus className="h-3 w-3" strokeWidth={2} />
            </button>
            <span className="w-5 text-center font-body text-xs font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep"
              aria-label={`Increase ${variant.name} quantity`}
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            aria-label={`Add ${variant.name} to cart`}
            className={buttonStyles('accent', 'sm', '!rounded-xl !px-3')}
          >
            {added ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <ShoppingBag className="h-4 w-4" strokeWidth={2} />}
          </button>
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
