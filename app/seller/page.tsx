import Link from 'next/link';
import {
  Sparkles,
  BadgeCheck,
  Wallet,
  MessageCircle,
  Smartphone,
  ClipboardList,
  Rocket,
  ArrowRight,
} from 'lucide-react';
import { buttonStyles } from '@/lib/button-styles';

/**
 * Seller marketing landing page — deliberately NOT linked from the public
 * site's header, footer, or homepage. Idara's own team shares this URL
 * directly with sellers they're onboarding; it isn't meant to be discovered
 * by browsing. The actual signup flow lives at /seller/register, one click
 * away from here.
 */

const VALUE_PROPS = [
  {
    icon: Wallet,
    title: 'Free to list',
    body: 'No posting fees, no commission cuts — list your products and services at no cost.',
  },
  {
    icon: BadgeCheck,
    title: 'ITS-verified trust',
    body: "Your women-owned badge is earned through real ITS verification, not a checkbox.",
  },
  {
    icon: MessageCircle,
    title: 'Direct WhatsApp orders',
    body: 'Buyers reach you on your own number — no middleman, no relay, no lost messages.',
  },
  {
    icon: Smartphone,
    title: 'Runs from your phone',
    body: 'The Seller Portal is a mobile-friendly website — no app to install, no laptop needed.',
  },
];

const STEPS = [
  {
    icon: Smartphone,
    title: 'Sign in with your phone',
    body: 'One OTP, no password to remember.',
  },
  {
    icon: ClipboardList,
    title: 'Tell us about your business',
    body: 'Business name and your ITS ID for verification.',
  },
  {
    icon: Rocket,
    title: 'List and go live',
    body: 'Add your first product — it goes live once Customer Support verifies your ITS ID.',
  },
];

export default function SellerLandingPage() {
  return (
    <div className="min-h-screen bg-ivory">
      {/* Minimal top bar — this page stands alone, not part of the buyer site chrome */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-navy" strokeWidth={2} />
          <span className="font-heading text-lg font-semibold text-ink">WE Bohra</span>
        </div>
        <Link href="/seller/register" className={buttonStyles('primary', 'sm')}>
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy px-6 py-20 text-center sm:py-28">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 15%, rgba(217,190,132,0.25), transparent 45%), radial-gradient(circle at 80% 85%, rgba(31,92,85,0.3), transparent 45%)',
          }}
        />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <span className="rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 font-body text-xs font-semibold text-gold-soft">
            For Bohra women-owned businesses
          </span>
          <h1 className="font-heading text-3xl font-semibold leading-tight text-ivory sm:text-5xl">
            Your business, in front of buyers across India
          </h1>
          <p className="max-w-lg font-body text-base text-ivory/80">
            WE Bohra is a marketplace built specifically for Bohra women entrepreneurs — food,
            textile, beauty, IT services, and more. List for free, get verified, and start
            hearing from buyers directly.
          </p>
          <Link href="/seller/register" className={buttonStyles('accent', 'lg')}>
            Become a Seller
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
        <h2 className="mb-10 text-center font-heading text-2xl font-semibold text-ink">
          Why sell on WE Bohra
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/5">
                <prop.icon className="h-5 w-5 text-navy" strokeWidth={1.75} />
              </span>
              <p className="font-heading text-sm font-semibold text-ink">{prop.title}</p>
              <p className="font-body text-xs leading-relaxed text-ink-soft">{prop.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-ivory-deep px-6 py-16 sm:px-10">
        <h2 className="mb-10 text-center font-heading text-2xl font-semibold text-ink">
          How it works
        </h2>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-3 text-center">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-navy text-ivory shadow-md">
                <step.icon className="h-6 w-6" strokeWidth={1.75} />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold font-body text-[10px] font-bold text-ink">
                  {i + 1}
                </span>
              </span>
              <p className="font-heading text-sm font-semibold text-ink">{step.title}</p>
              <p className="max-w-[16rem] font-body text-xs text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center sm:px-10">
        <h2 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">
          Ready to get started?
        </h2>
        <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft">
          It takes a few minutes to register — your listings go live once your ITS ID is
          verified.
        </p>
        <Link href="/seller/register" className={buttonStyles('primary', 'lg', 'mt-6')}>
          Become a Seller
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </section>

      <footer className="border-t border-ink-soft/10 px-6 py-6 text-center font-body text-xs text-ink-soft">
        WE Bohra — a marketplace for Bohra women-owned businesses.
      </footer>
    </div>
  );
}
