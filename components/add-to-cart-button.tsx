'use client';

import { useState } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useCart } from '@/components/cart-context';
import { buttonStyles } from '@/lib/button-styles';

/** Quick add (qty 1) from a listing card's grid view — the PDP itself offers
 *  the full quantity picker and the separate Pickup & Pay flow. */
export function AddToCartButton({
  listingId,
  width = 'full',
  shape = 'pill',
}: {
  listingId: number;
  /** 'full' fills its container alone; 'share' takes an equal split of a
   *  flex row (used when sitting side-by-side with Buy on WhatsApp). */
  width?: 'full' | 'share';
  /** 'box' swaps the default pill for a softly-rounded rectangle — used
   *  where this sits side-by-side with Buy on WhatsApp on a listing tile. */
  shape?: 'pill' | 'box';
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    addItem(listingId, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      onClick={handleClick}
      className={buttonStyles(
        'secondary',
        'sm',
        `${width === 'full' ? 'w-full' : 'flex-1'} ${shape === 'box' ? '!rounded-xl !gap-1 !px-2' : ''}`,
      )}
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          Added
        </>
      ) : (
        <>
          <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
          Add to Cart
        </>
      )}
    </button>
  );
}
