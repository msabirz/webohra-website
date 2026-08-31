import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/**
 * Stripped chrome for the seller register/login/become pages — same idea as
 * app/(minimal): no marketplace header/footer, just a way back to the site.
 */
export default function SellerAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="border-b border-ink-soft/10 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <Sparkles className="h-5 w-5 text-navy" strokeWidth={2} />
            <span className="font-heading text-lg font-semibold text-ink">
              WE Bohra <span className="text-gold">Seller</span>
            </span>
          </Link>
          <Link href="/" className="font-body text-sm text-ink-soft hover:text-ink">
            Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
