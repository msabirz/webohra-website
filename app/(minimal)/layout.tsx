import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/**
 * Stripped chrome for focused, single-task pages (currently: order
 * confirmation) — no search bar, no categories, no cart icon. The full
 * marketplace header/footer would just be noise here; this is the
 * "secondary" header the requester asked for on pages like this.
 */
export default function MinimalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="border-b border-ink-soft/10 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <Sparkles className="h-5 w-5 text-navy" strokeWidth={2} />
            <span className="font-heading text-lg font-semibold text-ink">WE Bohra</span>
          </Link>
          <Link href="/faq" className="font-body text-sm text-ink-soft hover:text-ink">
            Need help?
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-ink-soft/10 px-6 py-5 text-center font-body text-xs text-ink-soft">
        WE Bohra — a marketplace for Bohra women-owned businesses.
      </footer>
    </div>
  );
}
