import Link from 'next/link';

/**
 * TEMPORARY stakeholder-facing audit page — 2026-09-05. Public, no auth,
 * deliberately outside app/seller/(portal) and app/seller/(auth). Every
 * row below was verified directly against the current codebase (see each
 * row's own note for the exact file/mechanism checked) — none of it is
 * assumed. The point of this page: "we will provide nothing free" — so
 * every real buyer-seller interaction channel needs a real answer for
 * how WE Bohra earns from it, not just the ones that already do.
 * Remove this route once every row below is either fixed or explicitly
 * accepted as free by the stakeholder.
 */

type Row = {
  channel: string;
  how: string;
  tracked: { ok: boolean; note: string };
  monetized: { ok: boolean; note: string };
  fix: string;
  status: 'live' | 'gap' | 'partial';
};

const ROWS: Row[] = [
  {
    channel: 'Product purchase — online payment',
    how: 'Buyer adds to cart, pays via Razorpay at checkout',
    tracked: { ok: true, note: 'Full order record, payment confirmed via Razorpay' },
    monetized: { ok: true, note: '10% commission, deducted automatically on payout' },
    fix: 'None needed — already live. (Real net margin is 7.64% not 10% today due to an unrecovered Razorpay fee — see the Plan Repricing Proposal.)',
    status: 'live',
  },
  {
    channel: 'Product purchase — Cash on Delivery / Pickup & Pay paid in cash',
    how: 'Buyer pays cash on delivery, or cash at pickup — same payment_method as COD, confirmed in schema (no separate "pickup" payment type exists)',
    tracked: { ok: true, note: 'Real order record exists' },
    monetized: { ok: false, note: 'Checked in code: a COD order never creates a payout row — no commission record, ever' },
    fix: 'Deduct commission (+ Delhivery cost if applicable) from the seller\'s wallet at the weekly settlement — same trigger as the online payout redesign.',
    status: 'gap',
  },
  {
    channel: 'WhatsApp — direct connect (Silver tier service)',
    how: 'Buyer taps straight through to the seller\'s own WhatsApp number — no relay, no request logged in her portal',
    tracked: { ok: true, note: 'A click is logged (whatsapp_contacts table) — but nothing about what happens after' },
    monetized: { ok: false, note: 'Zero per-use charge. The only monetization design is the flat Silver plan fee itself — and that fee isn\'t billed yet either' },
    fix: 'Short term: wire up subscription billing so the Silver fee is actually collected. Longer term: consider a monthly cap on direct-connect reveals, since one flat fee currently buys unlimited leads regardless of volume.',
    status: 'gap',
  },
  {
    channel: 'WhatsApp / portal — consultation request (Gold tier service)',
    how: 'Buyer submits a request; it lands in the seller\'s Enquiries; she opens WhatsApp herself — this is "the lead"',
    tracked: { ok: true, note: 'Real record in her Enquiries — the strongest tracking of any channel here' },
    monetized: { ok: false, note: 'Checked directly: zero commission logic anywhere in the enquiry/consultation-request routes' },
    fix: 'This is the easiest one to monetize — it\'s already a trackable, discrete event. Charge per lead delivered, or give a fixed number free per month then charge beyond it.',
    status: 'gap',
  },
  {
    channel: 'Phone / email — shown directly (Basic tier service)',
    how: 'Buyer calls or emails the seller directly — "Call Now" button or plain contact info',
    tracked: { ok: false, note: 'Checked directly in service-contact-action.tsx: the Call Now button has no logging call at all — not even a click count' },
    monetized: { ok: false, note: 'Completely invisible to WE Bohra today — the only channel with zero visibility of any kind' },
    fix: 'At minimum, log the reveal/click (same pattern as the WhatsApp table) so there\'s real data, even before deciding whether to charge for it. Basic is the entry tier — worth a deliberate call on whether to monetize this one or keep it as a free on-ramp.',
    status: 'gap',
  },
  {
    channel: 'Delhivery shipping',
    how: 'Seller ships via courier instead of self-managed',
    tracked: { ok: true, note: 'Shipment happens, but no cost is ever recorded against anyone' },
    monetized: { ok: false, note: 'Checked directly: buyer is charged ₹0, and nothing recovers the ~₹80/shipment real cost from the seller either' },
    fix: 'Recover the real cost from the seller\'s settlement (commission + Razorpay fee + Delhivery cost, all in one deduction) — see the Plan Repricing Proposal for the full design.',
    status: 'gap',
  },
  {
    channel: 'Subscription plan fee',
    how: 'Seller picks a paid tier for more listings/features',
    tracked: { ok: true, note: 'Real plan assignment, real price shown to her' },
    monetized: { ok: false, note: 'No code anywhere actually charges her for it — confirmed in the Business Model doc' },
    fix: 'Wire up recurring billing, reusing the existing Razorpay integration. Deferred to the wallet-first launch\'s "coming in a few months" phase.',
    status: 'partial',
  },
  {
    channel: 'Wallet balance',
    how: 'Seller tops up a wallet instead of picking a fixed plan',
    tracked: { ok: true, note: 'Real Razorpay top-up, credited correctly' },
    monetized: { ok: false, note: 'Nothing ever debits it — the commission_deduction transaction type exists in the schema but is never used' },
    fix: 'This is the wallet-first launch\'s core engine — the debit logic being built now covers commission, Razorpay fee-share, and Delhivery cost together.',
    status: 'partial',
  },
  {
    channel: 'Bonus-category listing sale',
    how: 'A sale from a seller\'s bonus listing (a category outside her main one)',
    tracked: { ok: true, note: 'The listing itself is real and sellable' },
    monetized: { ok: false, note: 'A separate 15% rate exists in Admin settings, but no code path applies it — confirmed directly' },
    fix: 'Apply the 15% rate at the same settlement step as ordinary commission, keyed off whether the listing is flagged as a bonus one.',
    status: 'gap',
  },
];

function StatusPill({ status }: { status: Row['status'] }) {
  const map = {
    live: { label: 'Live', cls: 'bg-teal/15 text-teal-deep' },
    gap: { label: 'Free today — gap', cls: 'bg-[#F7E4DE] text-[#8A3B26]' },
    partial: { label: 'Designed, not billed', cls: 'bg-gold-soft/40 text-[#5C4415]' },
  }[status];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide ${map.cls}`}>{map.label}</span>;
}

function CheckBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
        ok ? 'bg-teal/15 text-teal-deep' : 'bg-[#F7E4DE] text-[#8A3B26]'
      }`}
    >
      {ok ? '✓' : '✕'}
    </span>
  );
}

export default function WeBohraBusinessAuditPage() {
  const gapCount = ROWS.filter((r) => r.status === 'gap').length;

  return (
    <div className="min-h-screen bg-ivory font-body text-ink">
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-soft/15 bg-white px-6 py-4">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-navy-deep">
          <span className="h-2 w-2 rounded-full bg-gold" />
          WE Bohra Seller
        </div>
        <Link href="/seller/pricing" className="text-sm font-semibold text-ink-soft hover:text-navy">
          ← Pricing preview
        </Link>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-11">
        <div className="mb-6 rounded-lg border border-gold/50 bg-gold-soft/20 px-4 py-2 text-center text-xs font-semibold text-ink-soft">
          Temporary internal/stakeholder audit — not linked from the live site.
        </div>

        <header className="mb-8">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-gold">WE Bohra · Interaction &amp; Monetization Audit</div>
          <h1 className="mb-3 font-heading text-3xl font-bold text-navy-deep">Every way a buyer reaches a seller — and whether WE Bohra earns from it</h1>
          <p className="max-w-2xl text-[15px] text-ink-soft">
            The stated policy: nothing stays free by accident. Every row below was checked directly against the current
            code — not assumed — so this is a real inventory of what&apos;s live, what&apos;s tracked-but-unbilled, and
            what&apos;s completely invisible today.
          </p>
          <div className="mt-4 inline-block rounded-lg bg-[#F7E4DE] px-4 py-2 text-sm font-bold text-[#8A3B26]">
            {gapCount} of {ROWS.length} channels are free today with no monetization mechanism at all
          </div>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-ink-soft/15 bg-white">
          <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-3 font-bold">Channel</th>
                <th className="px-4 py-3 font-bold">Tracked?</th>
                <th className="px-4 py-3 font-bold">Monetized?</th>
                <th className="px-4 py-3 font-bold">Proposed fix</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.channel} className={i % 2 === 1 ? 'bg-ivory/60' : ''}>
                  <td className="border-b border-ink-soft/10 px-4 py-4 align-top">
                    <div className="font-semibold text-ink">{row.channel}</div>
                    <div className="mt-1 text-[12px] text-ink-soft">{row.how}</div>
                  </td>
                  <td className="border-b border-ink-soft/10 px-4 py-4 align-top">
                    <div className="mb-1"><CheckBadge ok={row.tracked.ok} /></div>
                    <div className="text-[11.5px] text-ink-soft">{row.tracked.note}</div>
                  </td>
                  <td className="border-b border-ink-soft/10 px-4 py-4 align-top">
                    <div className="mb-1"><CheckBadge ok={row.monetized.ok} /></div>
                    <div className="text-[11.5px] text-ink-soft">{row.monetized.note}</div>
                  </td>
                  <td className="border-b border-ink-soft/10 px-4 py-4 align-top text-[12px] text-ink-soft">{row.fix}</td>
                  <td className="border-b border-ink-soft/10 px-4 py-4 align-top">
                    <StatusPill status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-2xl bg-navy p-6 text-ivory">
          <h4 className="mb-2 font-heading text-base font-semibold text-white">The one deliberate exception worth deciding on purpose</h4>
          <p className="text-[13.5px] text-[#D7DEEA]">
            Basic-tier phone/email is the only channel where monetizing it at all is a real trade-off, not just an
            oversight — it&apos;s the cheapest entry tier, meant to be a low-friction on-ramp for the smallest sellers.
            Tracking it costs nothing and should happen regardless; charging for it is a judgment call the stakeholder
            should make explicitly, not something this audit assumes either way.
          </p>
        </div>

        <footer className="mt-9 text-center text-xs text-ink-soft">
          WE Bohra — Interaction &amp; Monetization Audit · temporary stakeholder preview, 2026-09-05 · every row checked
          directly against the current codebase
        </footer>
      </div>
    </div>
  );
}
