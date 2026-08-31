import { MessageCircle, ShieldCheck, Clock, Send, CheckCircle2 } from 'lucide-react';
import { ConsultationRequestButton } from '@/components/consultation-request-button';
import { categoryColor } from '@/lib/category-color';

type ServiceListing = {
  id: number;
  title: string;
  description: string;
  price: string;
  categoryName: string;
  categorySlug: string;
  subcategoryName: string;
  businessName: string | null;
  images: { id: number; url: string }[];
};

// Icons deliberately mirror the ones used at each matching moment elsewhere
// in the consultation flow — Send for the request-sent state on the
// tracking page, CheckCircle2 for "accepted" everywhere it appears (the
// Seller Portal's own Connect button included) — so the same shape means
// the same thing across the whole feature, not just here.
const HOW_IT_WORKS = [
  {
    icon: Send,
    title: 'Send a request',
    body: 'Tap below with your details — you\'ll get a request number to track it.',
  },
  {
    icon: CheckCircle2,
    title: 'She accepts on WhatsApp',
    body: 'Once she accepts, she messages you on WhatsApp directly to continue.',
  },
  {
    icon: Clock,
    title: 'Get it booked',
    body: 'Agree on timing and details together, entirely between the two of you.',
  },
];

/**
 * Service listings (local_service/remote_service) get a fundamentally
 * different layout from products — no cart, no shipping, no quantity.
 * Modeled on how service marketplaces (Urban Company etc.) present a
 * service: lead with the provider and the consultation action, not a
 * product-style buy box.
 */
export function ServiceDetailView({ listing }: { listing: ServiceListing }) {
  const accent = categoryColor(listing.categorySlug);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div
        className="flex flex-col items-center gap-4 rounded-3xl px-6 py-12 text-center"
        style={{ backgroundColor: `${accent}1f` }}
      >
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {listing.subcategoryName}
        </p>
        <h1 className="max-w-xl font-heading text-3xl font-semibold text-ink">{listing.title}</h1>
        {listing.businessName && (
          <p className="font-body text-sm text-ink-soft">by {listing.businessName}</p>
        )}
        <p className="font-heading text-2xl font-semibold text-navy">
          Starting at ₹{Number(listing.price).toLocaleString('en-IN')}
        </p>
        <ConsultationRequestButton
          listingId={listing.id}
          size="lg"
          label="Take Consultation"
          width="auto"
        />
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="flex flex-col gap-6 md:col-span-2">
          {listing.images.length > 0 && (
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
              <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Photos</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {listing.images.map((img) => (
                  <div key={img.id} className="aspect-square overflow-hidden rounded-xl bg-ivory-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="mb-3 font-heading text-lg font-semibold text-ink">About this service</h2>
            <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-ink-soft">
              {listing.description}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
            <h2 className="mb-5 font-heading text-lg font-semibold text-ink">
              How Take Consultation works
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.title} className="flex flex-col items-center gap-3 text-center">
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-navy/5 ring-1 ring-navy/10">
                    <step.icon className="h-6.5 w-6.5 text-navy" strokeWidth={1.6} />
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold font-body text-[11px] font-bold text-ink shadow-sm">
                      {i + 1}
                    </span>
                  </span>
                  <p className="font-heading text-sm font-semibold text-ink">{step.title}</p>
                  <p className="font-body text-xs leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
            <p className="mb-3 font-heading text-sm font-semibold text-ink">
              {listing.businessName ?? 'Service provider'}
            </p>
            <ul className="flex flex-col gap-2.5 font-body text-xs text-ink-soft">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-deep" strokeWidth={2} />
                Bohra women-owned business
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-teal-deep" strokeWidth={2} />
                Direct WhatsApp consultation
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
