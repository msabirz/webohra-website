'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, MapPin, ShoppingBag, Sparkles } from 'lucide-react';
import { getStoredLocation, type BuyerLocation } from '@/lib/location-client';
import { LocationPicker } from '@/components/location-picker';
import { useCart } from '@/components/cart-context';
import { AccountMenu } from '@/components/account-menu';

type Subcategory = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string; subcategories: Subcategory[] };

// Shared sizing so the location/account/cart pills line up pixel-for-pixel
// regardless of one-line vs two-line content inside them.
const PILL = 'flex h-10 shrink-0 items-center rounded-full border border-ivory/15 bg-white/5 transition hover:border-ivory/30 hover:bg-white/10';

// Hover-intent delays for the category mega-menu (2026-09-03) — a short
// show delay stops it flashing open while the cursor just passes over a
// chip on its way elsewhere; a slightly longer hide delay gives the
// cursor room to travel from the chip down into the panel itself without
// it closing underneath you.
const SHOW_DELAY_MS = 90;
const HIDE_DELAY_MS = 200;

// A compact dropdown (not the earlier full-width bar, per the user's own
// follow-up) — fixed width, position computed per-chip so it sits right
// under whichever one is open, clamped so it can't run off the row's
// right edge for a chip near the end of the strip.
const PANEL_WIDTH = 232;

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [location, setLocation] = useState<BuyerLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { count, openCart } = useCart();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [panelLeft, setPanelLeft] = useState(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<number, HTMLAnchorElement | null>>({});

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

  // A navigation (chip click, panel link click, or browser back/forward)
  // should always close the menu — without this it stays visually open,
  // pinned under whichever chip it last opened on, on the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function clearTimers() {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  // Positions the (fixed-width) panel directly under whichever chip
  // opened it, clamped so it never runs past the row's own right edge.
  function computePanelLeft(categoryId: number): number {
    const chip = chipRefs.current[categoryId];
    const row = rowRef.current;
    if (!chip || !row) return 0;
    const raw = chip.getBoundingClientRect().left - row.getBoundingClientRect().left;
    return Math.max(0, Math.min(raw, row.getBoundingClientRect().width - PANEL_WIDTH - 8));
  }

  function scheduleOpen(category: Category) {
    clearTimers();
    if (category.subcategories.length === 0) {
      setMenuOpen(false);
      return;
    }
    showTimer.current = setTimeout(() => {
      setActiveCategory(category);
      setPanelLeft(computePanelLeft(category.id));
      setMenuOpen(true);
    }, SHOW_DELAY_MS);
  }

  function scheduleClose() {
    clearTimers();
    hideTimer.current = setTimeout(() => setMenuOpen(false), HIDE_DELAY_MS);
  }

  function openNow(category: Category) {
    clearTimers();
    if (category.subcategories.length === 0) return;
    setActiveCategory(category);
    setPanelLeft(computePanelLeft(category.id));
    setMenuOpen(true);
  }

  useEffect(() => clearTimers, []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  }

  function dismissPicker() {
    sessionStorage.setItem('wb_location_prompt_dismissed', '1');
    setPickerOpen(false);
  }

  return (
    <header className="sticky top-0 z-20">
      {/* Row 1: brand utility bar. On mobile this becomes two stacked rows —
       *  logo + pills on top, search full-width beneath — since cramming a
       *  search box in alongside four other controls left it too small to
       *  use comfortably. sm: and up keeps the original single-row layout,
       *  search included inline. */}
      <div className="bg-navy/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:gap-2">
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/" className="flex shrink-0 items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-gold-soft" strokeWidth={2} />
              <span className="font-heading text-xl font-semibold tracking-tight text-ivory">
                WE Bohra
              </span>
            </Link>

            <SearchField q={q} setQ={setQ} onSubmit={handleSearch} className="relative hidden max-w-xl flex-1 sm:block" />

            <button
              onClick={() => setPickerOpen(true)}
              aria-label="Choose your location"
              className={`ml-auto gap-1.5 px-3 font-body text-ivory sm:ml-0 sm:px-3.5 ${PILL}`}
            >
              <MapPin className="h-4 w-4 text-gold-soft" strokeWidth={2} />
              <span className="hidden flex-col items-start leading-none sm:flex">
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

          <SearchField q={q} setQ={setQ} onSubmit={handleSearch} className="relative sm:hidden" />
        </div>
      </div>

      {/* Row 2: light utility nav — category chips + nearby. `relative` so
       *  the dropdown panel below anchors to this row (computed left
       *  offset, not clipped by the chip strip's own overflow-x-auto)
       *  rather than being confined to one chip's own narrow box. */}
      <div
        ref={rowRef}
        className="relative border-b border-ink-soft/10 bg-ivory/95 backdrop-blur-md"
        onMouseLeave={scheduleClose}
      >
        {/* justify-start on mobile (2026-09-04, real bug — center-aligning
         *  a horizontally-scrollable row hides that there's more to
         *  either side, since both edges get clipped equally with no
         *  visible "there's another chip right there" cue). Centers again
         *  from sm: up, where the full strip almost always fits. */}
        <div className="mx-auto flex max-w-6xl items-center justify-start gap-2 overflow-x-auto px-4 py-3 sm:justify-center">
          <Link
            href="/collections"
            className={`shrink-0 rounded-full px-4 py-2 font-body text-sm font-medium transition ${
              pathname === '/collections'
                ? 'bg-navy text-ivory shadow-sm'
                : 'text-ink-soft hover:bg-white hover:text-ink hover:shadow-sm'
            }`}
          >
            Collections
          </Link>
          {categories.map((c) => {
            const active = pathname === `/category/${c.slug}`;
            const isActiveTrigger = menuOpen && activeCategory?.id === c.id;
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                ref={(el) => {
                  chipRefs.current[c.id] = el;
                }}
                onMouseEnter={() => scheduleOpen(c)}
                onFocus={() => openNow(c)}
                onBlur={scheduleClose}
                className={`shrink-0 rounded-full px-4 py-2 font-body text-sm font-medium transition ${
                  active || isActiveTrigger
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

        {/* Dropdown panel — compact, fixed-width (PANEL_WIDTH), positioned
         *  under whichever chip opened it via the computed `left`, not a
         *  full-width bar. Always mounted (never unmounted/remounted on
         *  every hover) so it only ever fades/slides, never pops or
         *  flickers; content swaps under the fade when a new category
         *  opens. onMouseEnter here cancels the close timer so crossing
         *  the small gap between chip and panel doesn't close it. */}
        <div
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleClose}
          style={{ left: panelLeft, width: PANEL_WIDTH }}
          className={`absolute top-full z-10 mt-1.5 origin-top-left rounded-2xl bg-white p-2 shadow-xl ring-1 ring-ink-soft/10 transition-all duration-150 ease-out ${
            menuOpen && activeCategory
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
          }`}
        >
          {activeCategory && (
            <div className="flex flex-col">
              <p className="px-2.5 pb-1.5 pt-1 font-body text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                {activeCategory.name}
              </p>
              {activeCategory.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${activeCategory.slug}?subcategory=${sub.slug}`}
                  onFocus={clearTimers}
                  onBlur={scheduleClose}
                  className="rounded-lg px-2.5 py-2 font-body text-sm text-ink transition hover:bg-ivory-deep hover:text-navy"
                >
                  {sub.name}
                </Link>
              ))}
              <Link
                href={`/category/${activeCategory.slug}`}
                onFocus={clearTimers}
                onBlur={scheduleClose}
                className="mt-1 rounded-lg border-t border-ink-soft/10 px-2.5 pb-1 pt-2.5 font-body text-xs font-semibold text-navy transition hover:text-navy-deep"
              >
                View all {activeCategory.name}
              </Link>
            </div>
          )}
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

/** Rendered twice — inline on sm:+ (className hides it below that), full-
 *  width on mobile (className hides the inline one instead) — same `q`
 *  state and submit handler either way, so typing/searching works
 *  identically no matter which one is currently visible. */
function SearchField({
  q,
  setQ,
  onSubmit,
  className,
}: {
  q: string;
  setQ: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  className: string;
}) {
  return (
    <form onSubmit={onSubmit} className={className}>
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
  );
}
