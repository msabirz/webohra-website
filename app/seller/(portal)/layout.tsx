'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  Briefcase,
  ShoppingBag,
  MessageSquare,
  Handshake,
  Layers,
  Wallet,
  Landmark,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { authFetch, clearAuthToken, getAuthToken } from '@/lib/session-client';
import { SellerPortalContext, type SellerMe } from '@/lib/seller-context';
import { NotificationBell } from '@/components/seller/notification-bell';
import { PortalShellSkeleton } from '@/components/skeleton';
import { PortalNav, type NavEntry } from '@/components/portal-nav';

// Grouped 2026-09-03 (was one flat 9-item list) — a lone item stays a
// direct link (Dashboard, Products, Settings); anything with 2+ related
// items becomes a named group, same "submenus wherever it actually
// clarifies something" idea as the admin sidebar.
const NAV_ITEMS: NavEntry[] = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Products', icon: Package },
  { href: '/seller/portfolio', label: 'Portfolio', icon: Briefcase },
  {
    label: 'Orders & Enquiries',
    icon: ShoppingBag,
    children: [
      { href: '/seller/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/seller/enquiries', label: 'Enquiries', icon: MessageSquare },
      { href: '/seller/pickups', label: 'Pickups', icon: Handshake },
    ],
  },
  {
    label: 'Money',
    icon: Wallet,
    children: [
      { href: '/seller/subscription', label: 'Subscription', icon: Layers },
      { href: '/seller/wallet', label: 'Wallet', icon: Wallet },
      { href: '/seller/payouts', label: 'Payouts', icon: Landmark },
    ],
  },
  { href: '/seller/settings', label: 'Settings', icon: Settings },
];

export default function SellerPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<SellerMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadEnquiries, setUnreadEnquiries] = useState(0);

  const refreshUnread = useCallback(() => {
    authFetch('/api/sellers/enquiries/unread-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUnreadEnquiries(data.unread);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      router.push(`/seller/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const res = await authFetch('/api/auth/me');
    if (res.status === 401) {
      clearAuthToken();
      router.push(`/seller/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const data = await res.json();
    if (!data.sellerProfile) {
      router.push(`/seller/become?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setMe(data);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    // Owned once, here, rather than inside NotificationBell — that
    // component renders twice (mobile top bar + desktop sidebar, only one
    // visible at a time via CSS but both mounted), so polling inside it
    // would double every request for no reason. One interval for the whole
    // portal, regardless of how many places display the badge.
    refreshUnread();
    const interval = setInterval(refreshUnread, 15_000);
    function onVisible() {
      if (document.visibilityState === 'visible') refreshUnread();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshUnread);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshUnread);
    };
  }, [loading, refreshUnread]);

  function signOut() {
    clearAuthToken();
    router.push('/');
  }

  if (loading || !me) {
    return <PortalShellSkeleton navItems={NAV_ITEMS.length} />;
  }

  // Same unread count NotificationBell already polls — surfaced on the
  // Enquiries nav item too now that groups exist to put a badge on.
  const navWithBadges: NavEntry[] = NAV_ITEMS.map((entry) =>
    'children' in entry
      ? {
          ...entry,
          children: entry.children.map((c) =>
            c.href === '/seller/enquiries' ? { ...c, badge: unreadEnquiries || undefined } : c,
          ),
        }
      : entry,
  );

  return (
    <SellerPortalContext.Provider value={{ me, refresh: load, unreadEnquiries, refreshUnread }}>
      <div className="flex min-h-screen bg-ivory">
        {/* Mobile top bar */}
        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-ink-soft/10 bg-navy px-4 py-3 md:hidden">
          <Link href="/seller/dashboard" className="flex items-center gap-1.5">
            <Sparkles className="h-5 w-5 text-gold-soft" strokeWidth={2} />
            <span className="font-heading text-base font-semibold text-ivory">WE Bohra Seller</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle menu"
              className="rounded-full p-1.5 text-ivory hover:bg-white/10"
            >
              {mobileNavOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-ink-soft/10 bg-navy pt-16 transition-transform md:translate-x-0 md:pt-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="hidden items-center justify-between border-b border-white/10 px-6 py-5 md:flex">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-gold-soft" strokeWidth={2} />
              <span className="font-heading text-lg font-semibold text-ivory">WE Bohra Seller</span>
            </div>
            <NotificationBell />
          </div>

          <div className="border-b border-white/10 px-6 py-4">
            <p className="truncate font-heading text-sm font-semibold text-ivory">
              {me.sellerProfile.businessName}
            </p>
            {me.user.itsVerified ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal/20 px-2.5 py-1 font-body text-xs font-medium text-teal-deep">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                ITS verified
              </span>
            ) : (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 font-body text-xs font-medium text-gold-soft">
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                Verification pending
              </span>
            )}
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            <PortalNav
              items={navWithBadges}
              pathname={pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </nav>

          <div className="flex flex-col gap-1 border-t border-white/10 px-3 py-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-ivory/70 transition hover:bg-white/5 hover:text-ivory"
            >
              Back to site
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-ivory/70 transition hover:bg-white/5 hover:text-ivory"
            >
              <LogOut className="h-4.5 w-4.5" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </aside>

        {mobileNavOpen && (
          <button
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-10 bg-ink/40 md:hidden"
          />
        )}

        <main className="flex-1 px-4 py-8 pt-20 md:ml-64 md:px-8 md:py-10 md:pt-10">{children}</main>
      </div>
    </SellerPortalContext.Provider>
  );
}
