'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShieldCheck,
  Package,
  FolderTree,
  ShoppingBag,
  MessageSquare,
  Truck,
  Image as ImageIcon,
  MapPin,
  Building2,
  Layers,
  Wallet,
  Landmark,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { authFetch, clearAuthToken, getAuthToken } from '@/lib/session-client';
import { AdminPortalContext, type AdminMe } from '@/lib/admin-context';
import { PortalShellSkeleton } from '@/components/skeleton';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/sellers', label: 'Sellers', icon: ShieldCheck, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/products', label: 'Products', icon: Package, roles: ['admin', 'super_admin'] },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree, roles: ['admin', 'super_admin'] },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/pickups', label: 'Pickups', icon: Truck, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon, roles: ['admin', 'super_admin'] },
  { href: '/admin/jamaats', label: 'Jamaats', icon: MapPin, roles: ['admin', 'super_admin'] },
  { href: '/admin/webohra-offices', label: 'WeBohra Offices', icon: Building2, roles: ['admin', 'super_admin'] },
  { href: '/admin/subscription-plans', label: 'Subscription Plans', icon: Layers, roles: ['admin', 'super_admin'] },
  { href: '/admin/wallets', label: 'Wallets', icon: Wallet, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/payouts', label: 'Payouts', icon: Landmark, roles: ['customer_support', 'admin', 'super_admin'] },
  { href: '/admin/staff', label: 'Staff', icon: Users, roles: ['super_admin'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['customer_support', 'admin', 'super_admin'] },
] as const;

const ROLE_LABEL: Record<AdminMe['staffRole'], string> = {
  customer_support: 'Customer Support',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      router.push(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const res = await authFetch('/api/auth/me');
    if (res.status === 401) {
      clearAuthToken();
      router.push(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const data = await res.json();
    if (!data.user?.staffRole) {
      clearAuthToken();
      router.push('/admin/login');
      return;
    }
    setMe(data.user);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function signOut() {
    clearAuthToken();
    router.push('/');
  }

  if (loading || !me) {
    // Role isn't known yet at this point (that's what's loading), so this
    // uses the max nav length (super_admin's) as a reasonable placeholder
    // shape rather than under- or over-drawing it.
    return <PortalShellSkeleton navItems={NAV_ITEMS.length} />;
  }

  const visibleNav = NAV_ITEMS.filter((item) => (item.roles as readonly string[]).includes(me.staffRole));

  return (
    <AdminPortalContext.Provider value={{ me }}>
      <div className="flex min-h-screen bg-ivory">
        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-ink-soft/10 bg-navy px-4 py-3 md:hidden">
          <Link href="/admin/dashboard" className="flex items-center gap-1.5">
            <Sparkles className="h-5 w-5 text-gold-soft" strokeWidth={2} />
            <span className="font-heading text-base font-semibold text-ivory">WE Bohra Admin</span>
          </Link>
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle menu"
            className="rounded-full p-1.5 text-ivory hover:bg-white/10"
          >
            {mobileNavOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
          </button>
        </div>

        <aside
          className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-ink-soft/10 bg-navy pt-16 transition-transform md:translate-x-0 md:pt-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="hidden items-center gap-1.5 border-b border-white/10 px-6 py-5 md:flex">
            <Sparkles className="h-5 w-5 text-gold-soft" strokeWidth={2} />
            <span className="font-heading text-lg font-semibold text-ivory">WE Bohra Admin</span>
          </div>

          <div className="border-b border-white/10 px-6 py-4">
            <p className="truncate font-heading text-sm font-semibold text-ivory">
              {me.name ?? me.email ?? me.phone}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-body text-xs font-medium text-ivory/90">
              {ROLE_LABEL[me.staffRole]}
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {visibleNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium transition ${
                    active ? 'bg-white/10 text-ivory' : 'text-ivory/70 hover:bg-white/5 hover:text-ivory'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
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
    </AdminPortalContext.Provider>
  );
}
