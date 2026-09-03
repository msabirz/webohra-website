'use client';

import { useState } from 'react';
import { Package, Minus, Plus, Check } from 'lucide-react';
import { useCart } from '@/components/cart-context';
import { buttonStyles } from '@/lib/button-styles';
import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { PickupExclusiveCallout } from '@/components/pickup-exclusive-callout';
import type { Variant } from '@/components/variant-menu';

type PickupInfo = {
  pickupCity: string | null;
  buyerCity: string | undefined;
  eligible: boolean;
  onOrderNow: () => void;
};

/**
 * The physical-product PDP's variant picker — a compact photo-swatch row
 * (like a shade picker) with a live-updating name + price above it, and
 * ONE quantity + Add to Cart for whichever swatch is currently selected.
 *
 * Replaces VariantMenu/ProductVariantCard's stacked-full-width-cards
 * treatment on the product PDP specifically (2026-09-03 redesign,
 * user-approved mockup) — VariantMenu itself is untouched and still used
 * as-is for services (see service-detail-view.tsx), where a buyer
 * genuinely may want several different types in one order (a Mehndi
 * listing's coverage tiers, etc.) and swapping to single-select would be
 * a real regression there, not just a visual one. On a physical product,
 * a swatch is a style/color choice — you buy one at a time, exactly like
 * this component's real-world reference (a shade picker), and that
 * trade-off (no more one-click "2 of this + 1 of that") was called out
 * and accepted before building this.
 */
export function ProductVariantPicker({
  listingId,
  variants,
  pickup,
}: {
  listingId: number;
  variants: Variant[];
  /** Undefined when the listing doesn't have Pickup & Pay turned on at
   *  all — see PickupExclusiveCallout's own comment for what "no
   *  resolvable location" (still passed through, city null) does. */
  pickup?: PickupInfo;
}) {
  const { addItem, openCart } = useCart();
  const [selected, setSelected] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = variants[selected];
  const outOfStock = variant.stockQuantity === 0;

  function handleSelect(i: number) {
    setSelected(i);
    setQuantity(1);
    setAdded(false);
  }

  function handleAdd() {
    addItem(listingId, quantity, variant.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="font-heading text-3xl font-semibold text-navy">
        ₹{Number(variant.price).toLocaleString('en-IN')}
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="font-body text-xs text-ink-soft">
          Style: <span className="font-semibold text-ink">{variant.name}</span>
        </p>
        <div className="flex flex-wrap gap-2.5">
          {variants.map((v, i) => (
            <button
              key={v.id}
              onClick={() => handleSelect(i)}
              aria-label={v.name}
              aria-pressed={selected === i}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl transition-all ${
                selected === i
                  ? '-translate-y-0.5 ring-2 ring-navy ring-offset-2'
                  : 'opacity-70 ring-1 ring-ink-soft/15 hover:opacity-100'
              }`}
            >
              {v.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
                <img src={v.images[0].url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ivory-deep">
                  <Package className="h-5 w-5 text-ink-soft/30" strokeWidth={1.5} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {pickup && (
        <PickupExclusiveCallout
          pickupCity={pickup.pickupCity}
          buyerCity={pickup.buyerCity}
          eligible={pickup.eligible}
          onOrderNow={pickup.onOrderNow}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-ink-soft/20 p-1">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <span className="w-6 text-center font-body text-sm font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <button onClick={handleAdd} disabled={outOfStock} className={buttonStyles('accent', 'lg', 'flex-1')}>
            {outOfStock ? (
              'Out of stock'
            ) : added ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Added
              </>
            ) : (
              'Add to Cart'
            )}
          </button>
        </div>
        {added && (
          <button onClick={openCart} className="font-body text-xs text-navy underline">
            View cart
          </button>
        )}
      </div>

      <WhatsAppBuyButton
        listingId={listingId}
        variantId={variant.id}
        variantName={variant.name}
        size="lg"
        label="Buy on WhatsApp"
      />
    </div>
  );
}
