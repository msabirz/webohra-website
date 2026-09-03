'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type NavLeaf = { href: string; label: string; icon: LucideIcon; badge?: number };
export type NavGroup = { label: string; icon: LucideIcon; children: NavLeaf[] };
export type NavEntry = NavLeaf | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared sidebar nav renderer for both /admin and /seller portal shells
 * (2026-09-03, replacing each layout's own flat `.map()` over NAV_ITEMS).
 * A flat NavLeaf renders as a direct link; a NavGroup renders as a
 * collapsible section — auto-expanded on first render when one of its own
 * children is the active route, collapsed otherwise — so a long nav list
 * stays scannable as more sections get added over time, rather than one
 * long flat list. The sidebar itself scrolls (see both layout.tsx's own
 * `overflow-y-auto` on the <nav> this renders inside), so nothing here
 * needs to fit without scrolling on its own.
 */
export function PortalNav({ items, pathname, onNavigate }: { items: NavEntry[]; pathname: string; onNavigate: () => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const entry of items) {
      if (isGroup(entry) && entry.children.some((c) => isActive(pathname, c.href))) {
        initial[entry.label] = true;
      }
    }
    return initial;
  });

  return (
    <>
      {items.map((entry) => {
        if (!isGroup(entry)) {
          const active = isActive(pathname, entry.href);
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium transition ${
                active ? 'bg-white/10 text-ivory' : 'text-ivory/70 hover:bg-white/5 hover:text-ivory'
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{entry.label}</span>
              {!!entry.badge && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 font-body text-[11px] font-bold text-ink">
                  {entry.badge}
                </span>
              )}
            </Link>
          );
        }

        const Icon = entry.icon;
        const open = openGroups[entry.label] ?? false;
        const groupActive = entry.children.some((c) => isActive(pathname, c.href));
        return (
          <div key={entry.label} className="flex flex-col">
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [entry.label]: !open }))}
              aria-expanded={open}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium transition ${
                groupActive ? 'text-ivory' : 'text-ivory/70 hover:bg-white/5 hover:text-ivory'
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{entry.label}</span>
              <ChevronDown
                className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </button>
            {open && (
              <div className="ml-4 flex flex-col gap-1 border-l border-white/10 py-1 pl-3">
                {entry.children.map((child) => {
                  const active = isActive(pathname, child.href);
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-body text-sm transition ${
                        active ? 'bg-white/10 text-ivory' : 'text-ivory/60 hover:bg-white/5 hover:text-ivory'
                      }`}
                    >
                      <ChildIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
                      <span className="truncate">{child.label}</span>
                      {!!child.badge && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 font-body text-[11px] font-bold text-ink">
                          {child.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
