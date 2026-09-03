'use client';

import { Sparkles, MapPin } from 'lucide-react';

/**
 * The product PDP's Pickup & Pay callout (2026-09-03, restyled twice the
 * same day per the user's own follow-ups) — was a plain selectable
 * "Delivery vs Pickup" radio row lower down the page; then a tall
 * gradient card with its own full-width button; now a single compact
 * line ("Exclusively available for pickup in {city}" + an inline Order
 * Now action) directly below the swatch picker, with an "— OR —" divider
 * beneath it to visually split it from the standard qty/Add to Cart flow
 * that follows — two real alternatives, not one feature buried under
 * another. Same underlying mechanism as always: Order Now opens the same
 * PickupRequestModal the old row did.
 *
 * Renders nothing when the listing has no resolvable pickup location at
 * all (seller hasn't finished setting up her address/office — see
 * lib/pickup.ts) — a silent no-op rather than a dead informational line,
 * since a buyer can't act on it either way. The OR divider only makes
 * sense when there's a real, clickable alternative, so it's part of the
 * eligible case only — the "not eligible" case is still a single small
 * line, just without the divider under it.
 */
export function PickupExclusiveCallout({
  pickupCity,
  buyerCity,
  eligible,
  onOrderNow,
}: {
  pickupCity: string | null;
  buyerCity: string | undefined;
  eligible: boolean;
  onOrderNow: () => void;
}) {
  if (!pickupCity) return null;

  if (eligible) {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={onOrderNow}
          className="flex items-center justify-between gap-2 rounded-full bg-gold/15 px-4 py-2 text-left ring-1 ring-gold/30 transition hover:bg-gold/25"
        >
          <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-ink">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
            Exclusively available for pickup in {pickupCity}
          </span>
          <span className="shrink-0 font-body text-xs font-bold text-navy">Order Now →</span>
        </button>

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-ink-soft/15" />
          <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Or</span>
          <span className="h-px flex-1 bg-ink-soft/15" />
        </div>
      </div>
    );
  }

  return (
    <p className="flex items-start gap-1.5 font-body text-xs text-ink-soft">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {buyerCity
        ? `Pickup & Pay is only available in ${pickupCity} — not ${buyerCity}.`
        : `Pickup & Pay is available in ${pickupCity} — set your location to check eligibility.`}
    </p>
  );
}
