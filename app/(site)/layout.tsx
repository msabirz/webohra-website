import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CartProvider } from '@/components/cart-context';
import { CartDrawer } from '@/components/cart-drawer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-ivory">
        <SiteHeader />
        {/* min-w-0 (2026-09-04, preemptive — same class of bug fixed on
         *  the admin/seller portal shells, see their own comments: a
         *  flex-1 item's default min-width:auto lets wide content deep
         *  inside force the whole page into horizontal scroll). No buyer
         *  page currently has content wide enough to trigger it, but nor
         *  did the seller one until a table did — cheap to guard now. */}
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6">{children}</main>
        <SiteFooter />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
