'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, MessageCircle } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { useSellerPortal } from '@/lib/seller-context';

type RecentEnquiry = {
  id: number;
  requestNumber: string;
  buyerName: string;
  listingTitle: string;
  status: string;
  createdAt: string;
};

const MENU_WIDTH = 320; // matches the dropdown's w-80

/** Bell icon + unread badge for new Take Consultation requests. The unread
 *  count itself is polled once, centrally, by the portal layout (see
 *  lib/seller-context.tsx's comment) — this component only reads it, since
 *  it's rendered twice (mobile top bar + desktop sidebar) and polling
 *  independently in each would double every request for nothing. A click
 *  opens a preview dropdown of the most recent requests (any status) with a
 *  link into the full Enquiries page. Uses a portal for the dropdown, same
 *  stacking-context-escape pattern as components/account-menu.tsx. */
export function NotificationBell() {
  const { unreadEnquiries, refreshUnread } = useSellerPortal();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentEnquiry[] | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggleOpen() {
    if (!open) {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        // Anchored by `left`, not `right` — this button can sit near the
        // left edge (the desktop sidebar), where a `right: innerWidth -
        // rect.right` offset blows up to a huge value and pushes the menu
        // off-screen. Clamp so the dropdown always stays within the
        // viewport regardless of where the trigger is.
        const left = Math.min(Math.max(rect.left, 8), window.innerWidth - MENU_WIDTH - 8);
        setMenuPos({ top: rect.bottom + 8, left });
      }
      authFetch('/api/sellers/enquiries')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setRecent((data?.enquiries ?? []).slice(0, 5)));
      // Opening the bell is a real signal she's checking — worth an
      // immediate refresh on top of the shared background poll.
      refreshUnread();
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ivory/80 transition hover:bg-white/10 hover:text-ivory"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={2} />
        {unreadEnquiries > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-gold px-1 font-body text-[10px] font-bold text-ink">
            {unreadEnquiries > 9 ? '9+' : unreadEnquiries}
          </span>
        )}
      </button>

      {open &&
        menuPos &&
        createPortal(
          <>
            <button aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
            <div
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-50 w-80 overflow-hidden rounded-2xl border border-ink-soft/10 bg-white shadow-lg"
            >
              <p className="border-b border-ink-soft/10 px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Consultation requests
              </p>
              {recent === null ? (
                <p className="px-4 py-6 text-center font-body text-sm text-ink-soft">Loading…</p>
              ) : recent.length === 0 ? (
                <p className="px-4 py-6 text-center font-body text-sm text-ink-soft">No requests yet.</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {recent.map((e) => (
                    <li key={e.id}>
                      <Link
                        href="/seller/enquiries"
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 border-b border-ink-soft/5 px-4 py-3 transition last:border-0 hover:bg-ivory-deep/50"
                      >
                        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-deep" strokeWidth={2} />
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm text-ink">
                            <span className="font-medium">{e.buyerName}</span> — {e.listingTitle}
                          </p>
                          <p className="font-body text-xs text-ink-soft">
                            {e.status === 'initiated' ? 'New' : e.status} ·{' '}
                            {new Date(e.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/seller/enquiries"
                onClick={() => setOpen(false)}
                className="block border-t border-ink-soft/10 px-4 py-2.5 text-center font-body text-sm font-medium text-navy hover:underline"
              >
                View all
              </Link>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
