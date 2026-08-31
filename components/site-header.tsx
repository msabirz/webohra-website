'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, MapPin, ShoppingBag, Sparkles } from 'lucide-react';
import { getStoredLocation, type BuyerLocation } from '@/lib/location-client';
import { LocationPicker } from '@/components/location-picker';
import { useCart } from '@/components/cart-context';
import { AccountMenu } from '@/components/account-menu';

type Category = { id: number; name: string; slug: string };

// Shared sizing so the location/account/cart pills line up pixel-for-pixel
// regardless of one-line vs two-line content inside them.
const PILL = 'flex h-10 shrink-0 items-center rounded-full border border-ivory/15 bg-white/5 transition hover:border-ivory/30 hover:bg-white/10';

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState<BuyerLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { count, openCart } = useCart();

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => {});

    const stored = getStoredLocation();
    setLocation(stored);
    if (!stored && !sessionStorage.getItem('wb_location_prompt_dismissed')) {
      setPickerOpen(true);
    }
  }, []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  }

  function dismissPicker() {
    sessionStorage.setItem('wb_location_prompt_dismissed', '1');
    setPickerOpen(false);
  }

  return (
    <header className="sticky top-0 z-10">
      {/* Row 1: brand utility bar */}
      <div className="bg-navy/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <Sparkles className="h-5 w-5 text-gold-soft" strokeWidth={2} />
            <span className="font-heading text-xl font-semibold tracking-tight text-ivory">
              WE Bohra
            </span>
          </Link>

          <form onSubmit={handleSearch} className="relative max-w-xl flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              strokeWidth={2}
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products and services…"
              className="h-10 w-full rounded-full border-0 bg-white pl-10 pr-4 font-body text-sm text-ink shadow-inner transition focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </form>

          <button
            onClick={() => setPickerOpen(true)}
            className={`hidden gap-1.5 px-3.5 font-body text-ivory sm:flex ${PILL}`}
          >
            <MapPin className="h-4 w-4 text-gold-soft" strokeWidth={2} />
            <span className="flex flex-col items-start leading-none">
              <span className="text-[10px] text-ivory/55">Deliver to</span>
              <span className="mt-0.5 text-xs font-semibold">
                {location?.city ?? 'Select location'}
              </span>
            </span>
          </button>

          <AccountMenu pillClassName={PILL} />

          <button
            onClick={openCart}
            aria-label="Open cart"
            className={`relative gap-2 px-3.5 font-body text-sm font-medium text-ivory ${PILL}`}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Bag</span>
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold font-body text-[10px] font-bold text-ink ring-2 ring-navy">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Row 2: light utility nav — category chips + nearby */}
      <div className="border-b border-ink-soft/10 bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 overflow-x-auto px-4 py-3">
          {categories.map((c) => {
            const active = pathname === `/c/${c.slug}`;
            return (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className={`shrink-0 rounded-full px-4 py-2 font-body text-sm font-medium transition ${
                  active
                    ? 'bg-navy text-ivory shadow-sm'
                    : 'text-ink-soft hover:bg-white hover:text-ink hover:shadow-sm'
                }`}
              >
                {c.name}
              </Link>
            );
          })}
          <Link
            href="/nearby"
            className={`ml-1 flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-body text-sm font-semibold transition ${
              pathname === '/nearby'
                ? 'bg-teal text-ivory shadow-sm'
                : 'bg-teal/10 text-teal-deep hover:bg-teal/20'
            }`}
          >
            <MapPin className="h-4 w-4" strokeWidth={2.5} />
            Nearby
          </Link>
        </div>
      </div>

      {pickerOpen && (
        <LocationPicker
          onClose={dismissPicker}
          onSelect={(loc) => {
            setLocation(loc);
            setPickerOpen(false);
          }}
        />
      )}
    </header>
  );
}
