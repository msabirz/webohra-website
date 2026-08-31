import { Handshake, Wallet, Store } from 'lucide-react';

const FAQS = [
  {
    icon: Handshake,
    q: 'How does Pickup & Pay work?',
    a: 'Pick a date and place on the collection page — the seller confirms with you directly and you pay her in person when you collect it. No shipping, no online payment.',
  },
  {
    icon: Wallet,
    q: 'Is online payment available?',
    a: 'Not yet — Cash on Delivery is the only checkout option today. Online payment is coming soon.',
  },
  {
    icon: Store,
    q: 'How do I sell on WE Bohra?',
    a: 'Tap "Sell on WE Bohra" and sign in with your phone number. Your products go live once your ITS ID is verified.',
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">Frequently asked questions</h1>
      <div className="flex flex-col gap-3">
        {FAQS.map((item) => (
          <div
            key={item.q}
            className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
              <item.icon className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold text-ink">{item.q}</p>
              <p className="mt-1 font-body text-sm leading-relaxed text-ink-soft">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
