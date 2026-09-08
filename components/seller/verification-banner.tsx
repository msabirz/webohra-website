'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Circle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { SellerReadiness } from '@/lib/seller-readiness';

/**
 * Item 38 (2026-09-09) — the answer to "after she registers, nothing ever
 * tells her what's still needed." Shown on every portal page (rendered once
 * in app/seller/(portal)/layout.tsx) until every mandatory item is done,
 * then disappears entirely. Deliberately a banner, not a blocking modal or
 * a forced wizard — she can keep drafting listings and exploring the portal
 * freely; this only nags about what PUBLISHING actually requires (see
 * lib/seller-readiness.ts for the enforcement side).
 */
export function VerificationBanner({ readiness }: { readiness: SellerReadiness | null }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!readiness || readiness.allDone) return null;

  const items: { done: boolean; label: string; href: string }[] = [
    { done: readiness.itsVerified, label: 'ITS ID verified by Admin', href: '/seller/settings' },
    { done: readiness.itsCardUploaded, label: 'ITS card photo uploaded', href: '/seller/settings' },
    {
      done: readiness.taxIdVerified,
      label: readiness.taxIdRejectedReason
        ? 'GST/Udyam number resubmitted — was rejected'
        : readiness.taxIdSubmitted
          ? 'GST/Udyam number verified by Admin'
          : 'GST/Udyam number submitted',
      href: '/seller/tax-compliance',
    },
    { done: readiness.taxIdDocumentUploaded, label: 'GST/Udyam certificate photo uploaded', href: '/seller/tax-compliance' },
    { done: readiness.payoutMethodSet, label: 'Payout method added (UPI or bank account)', href: '/seller/payouts' },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-gold/10 ring-1 ring-gold/30">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.75} />
          <div>
            <p className="font-body text-sm font-semibold text-ink">
              Finish these before you can publish — {doneCount} of {items.length} done
            </p>
            <p className="font-body text-xs text-ink-soft">
              You can keep building draft listings in the meantime — none of this blocks that.
            </p>
          </div>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={2} />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={2} />
        )}
      </button>
      {!collapsed && (
        <ul className="flex flex-col gap-1 border-t border-gold/20 px-5 py-3">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 font-body text-sm transition hover:bg-white/50"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" strokeWidth={2} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-ink-soft/40" strokeWidth={2} />
                )}
                <span className={item.done ? 'text-ink-soft line-through' : 'font-medium text-ink'}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
