'use client';

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * A small (i) icon that reveals a short plain-language explanation on
 * click — for exactly the spots where a non-technical admin needs to know
 * what an action actually does before clicking it (see /admin/payouts'
 * "Send via RazorpayX" vs "Mark as paid manually" — two real, different
 * actions that must never be confused with each other). Click-to-open
 * rather than hover, so it works the same on touch devices; closes on an
 * outside click.
 */
export function InfoPopover({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More info"
        aria-expanded={open}
        className="flex h-4.5 w-4.5 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep hover:text-navy"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open && (
        <div
          className={`absolute top-full z-20 mt-1.5 w-64 rounded-xl bg-ink px-3 py-2.5 font-body text-xs leading-relaxed text-ivory shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
