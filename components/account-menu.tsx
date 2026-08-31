'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, ChevronDown, Store, LogOut, UserCircle } from 'lucide-react';
import { useCurrentUser } from '@/lib/use-current-user';
import { clearAuthToken } from '@/lib/session-client';

export function AccountMenu({ pillClassName }: { pillClassName: string }) {
  const { user, sellerProfile, loading } = useCurrentUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (loading) return <span className="h-10 w-10 shrink-0" />;

  if (!user) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(pathname)}`}
        className={`gap-1.5 px-3.5 font-body text-sm font-medium text-ivory ${pillClassName}`}
      >
        <User className="h-4 w-4" strokeWidth={2} />
        <span className="hidden sm:inline">Login</span>
      </Link>
    );
  }

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className={`gap-1.5 px-3.5 font-body text-sm font-medium text-ivory ${pillClassName}`}
      >
        <User className="h-4 w-4" strokeWidth={2} />
        <span className="hidden max-w-[9rem] truncate sm:inline">{user.name ?? user.phone}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
      </button>

      {/* Portaled to <body> — both header rows use backdrop-blur, which each
          creates its own stacking context. A dropdown nested inside row 1's
          context would get painted UNDER row 2 (a later DOM sibling), no
          matter how high its z-index — the only reliable fix is to render
          it outside the header's DOM subtree entirely. */}
      {open &&
        menuPos &&
        createPortal(
          <>
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              style={{ top: menuPos.top, right: menuPos.right }}
              className="fixed z-50 w-52 overflow-hidden rounded-xl border border-ink-soft/10 bg-white py-1.5 shadow-lg"
            >
              <p className="border-b border-ink-soft/10 px-4 py-2.5 font-body text-xs text-ink-soft">
                {user.phone}
              </p>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-ink transition hover:bg-ivory-deep"
              >
                <UserCircle className="h-4 w-4 text-ink-soft" strokeWidth={2} />
                My profile
              </Link>
              {sellerProfile && (
                <Link
                  href="/seller/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 font-body text-sm text-ink transition hover:bg-ivory-deep"
                >
                  <Store className="h-4 w-4 text-ink-soft" strokeWidth={2} />
                  Seller dashboard
                </Link>
              )}
              <button
                onClick={() => {
                  clearAuthToken();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-body text-sm text-ink transition hover:bg-ivory-deep"
              >
                <LogOut className="h-4 w-4 text-ink-soft" strokeWidth={2} />
                Sign out
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
