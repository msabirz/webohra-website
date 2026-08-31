'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Sparkles, Search } from 'lucide-react';
import { buttonStyles } from '@/lib/button-styles';

const LINK_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Shop',
    links: [
      { label: 'All categories', href: '/search' },
      { label: 'Nearby', href: '/nearby' },
      { label: 'Track an order or request', href: '#track-order' },
    ],
  },
  {
    // Seller signup is deliberately not linked here — Idara's team shares
    // that URL directly, not via public navigation (see app/seller/page.tsx).
    heading: 'Account',
    links: [
      { label: 'My profile', href: '/account' },
      { label: 'Order history', href: '/account#orders' },
      { label: 'My requests', href: '/account#requests' },
      { label: 'Seller dashboard', href: '/seller/dashboard' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About WE Bohra', href: '/about' },
      { label: 'Contact us', href: '/contact' },
      { label: 'FAQs', href: '/faq' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Shipping & Returns', href: '/shipping-returns' },
    ],
  },
];

export function SiteFooter() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');

  function trackOrder(event: FormEvent) {
    event.preventDefault();
    const id = orderId.trim();
    if (!id) return;
    // "WR" = a Take Consultation request number, everything else (the "WB"
    // order-number format) tracks as an order — see lib/ids.ts.
    router.push(id.toUpperCase().startsWith('WR') ? `/request/${id}` : `/order/${id}`);
  }

  return (
    <footer className="border-t border-ivory/10 bg-navy-deep">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div
          id="track-order"
          className="mb-10 flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-navy to-navy-deep px-7 py-7 text-center shadow-lg sm:flex-row sm:justify-between sm:text-left"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
              <Package className="h-5 w-5 text-gold-soft" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-heading text-base font-semibold text-ivory">Track your order or request</p>
              <p className="font-body text-xs text-ivory/60">
                Enter your order (WB…) or consultation request (WR…) number.
              </p>
            </div>
          </div>
          <form onSubmit={trackOrder} className="flex w-full max-w-xs gap-2 sm:w-auto">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. WB251231-A1B2C or WR251231-A1B2C"
                className="w-full rounded-full border-0 py-2.5 pl-10 pr-4 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <button type="submit" className={buttonStyles('accent', 'md', 'shrink-0')}>
              Track
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {LINK_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 font-heading text-sm font-semibold text-ivory">{col.heading}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-body text-xs text-ivory/60 transition hover:text-gold-soft"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ivory/10 pt-7 sm:flex-row">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-gold-soft" strokeWidth={2} />
            <p className="font-heading text-sm font-semibold text-ivory">WE Bohra</p>
          </div>
          <p className="font-body text-xs text-ivory/50">
            A marketplace for Bohra women-owned businesses.
          </p>
          <div className="flex gap-3 font-body text-xs text-ivory/50">
            <span>India</span>
            <span>·</span>
            <span>support@webohra.example</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
