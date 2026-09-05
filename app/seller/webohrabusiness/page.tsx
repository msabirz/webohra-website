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
    fix: 'Same 10% commission as online orders, deducted from her wallet at settlement — no extra/higher rate. Fair because it mirrors what she\'d already owe if the buyer had paid online.',
    status: 'gap',
  },
  {
    channel: 'WhatsApp — direct connect (Silver tier service)',
    how: 'Buyer taps straight through to the seller\'s own WhatsApp number — no relay, no request logged in her portal',
    tracked: { ok: true, note: 'A click is logged (whatsapp_contacts table) — but nothing about what happens after' },
    monetized: { ok: false, note: 'Zero per-use charge. The only monetization design is the flat Silver plan fee itself — and that fee isn\'t billed yet either' },
    fix: 'Keep this fully unmetered — no per-click charge, no cap. Wire up the flat Silver fee once subscriptions launch; while on Wallet, funded access alone unlocks it. Metering leads would create an unpredictable bill for a seller who can\'t control how many people click — the wrong risk for this audience.',
    status: 'gap',
  },
  {
    channel: 'WhatsApp / portal — consultation request (Gold tier service)',
    how: 'Buyer submits a request; it lands in the seller\'s Enquiries; she opens WhatsApp herself — this is "the lead"',
    tracked: { ok: true, note: 'Real record in her Enquiries — the strongest tracking of any channel here' },
    monetized: { ok: false, note: 'Checked directly: zero commission logic anywhere in the enquiry/consultation-request routes' },
    fix: 'Flat ₹10, deducted from her wallet the moment the lead lands in her Enquiries — WE Bohra\'s job is delivering a qualified lead; converting it is her own skill, not a risk the platform should carry. No self-reporting needed, and lead volume is naturally bounded by real buyer intent, so ₹10 stays a small, predictable cost even across several leads a month.',
    status: 'gap',
  },
  {
    channel: 'Phone / email — shown directly (Basic tier service)',
    how: 'Buyer calls or emails the seller directly — "Call Now" button or plain contact info',
    tracked: { ok: false, note: 'Checked directly in service-contact-action.tsx: the Call Now button has no logging call at all — not even a click count' },
    monetized: { ok: false, note: 'Completely invisible to WE Bohra today — the only channel with zero visibility of any kind' },
    fix: 'Recommend leaving this genuinely free, permanently — she\'s often testing whether she can sell at all, and this is her lowest-friction on-ramp. Add tracking only (zero cost to her), never a charge.',
    status: 'gap',
  },
  {
    channel: 'Delhivery shipping',
    how: 'Seller ships via courier instead of self-managed',
    tracked: { ok: true, note: 'Shipment happens, but no cost is ever recorded against anyone' },
    monetized: { ok: false, note: 'Checked directly: buyer is charged ₹0, and nothing recovers the ~₹80/shipment real cost from the seller either' },
    fix: 'Already the right shape for this audience: recovered only from her settlement, only when a sale actually happens — zero upfront cost, zero risk of an unaffordable bill. See the Plan Repricing Proposal for the full design.',
    status: 'gap',
  },
  {
    channel: 'Subscription plan fee',
    how: 'Seller picks a paid tier for more listings/features',
    tracked: { ok: true, note: 'Real plan assignment, real price shown to her' },
    monetized: { ok: false, note: 'No code anywhere actually charges her for it — confirmed in the Business Model doc' },
    fix: 'Position as an earned upgrade, never the default: show her, from her own real wallet history, "you paid ₹850 in deductions last month — Gold at ₹786 would have saved you ₹64." Only pitch it once the math genuinely favors her.',
    status: 'partial',
  },
  {
    channel: 'Wallet balance',
    how: 'Seller tops up a wallet instead of picking a fixed plan',
    tracked: { ok: true, note: 'Real Razorpay top-up, credited correctly' },
    monetized: { ok: false, note: 'Nothing ever debits it — the commission_deduction transaction type exists in the schema but is never used' },
    fix: 'The wallet-first launch\'s core engine. Also worth lowering the entry barrier further: consider ₹200–300 minimum recharge (not ₹500) and a ₹50 minimum balance (not ₹100), so a small shortfall doesn\'t suddenly pull her listings.',
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

        <div className="mt-9 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-ink-soft/20" />
          Wallet vs. Subscription — how the fix differs
          <span className="h-px flex-1 bg-ink-soft/20" />
        </div>

        <div className="mb-6 rounded-lg border border-teal/30 bg-teal/10 px-4 py-3 text-[13px] text-teal-deep">
          <b>Governing principle:</b> most WE Bohra sellers are homemakers running a small, often seasonal business —
          not sellers with an existing high-follower audience who can treat this as a serious income stream and
          comfortably absorb variable costs. For this audience, <b>pay only when you earn</b> (a % of a real sale) is
          safe — a flat fee or a per-use toll can bite in a month she sells nothing. Every recommendation below follows
          from that, and it&apos;s why Wallet is the launch plan, not Subscription. One deliberate exception: the flat
          ₹10 lead fee below is charged on delivery, not on a sale — accepted because the amount is small and lead
          volume is bounded by real buyer intent, not because the principle stopped applying.
        </div>

        <div className="overflow-x-auto rounded-2xl border border-ink-soft/15 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-teal-deep text-white">
                <th className="px-4 py-3 font-bold">Channel</th>
                <th className="px-4 py-3 font-bold">On Wallet (now)</th>
                <th className="px-4 py-3 font-bold">On a fixed Subscription (later)</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  channel: 'COD / cash orders',
                  wallet: 'Same 10% commission as online, deducted from wallet at settlement — no extra rate for paying cash.',
                  sub: 'Same 10% baseline. Could offer a reduced rate (e.g. 8%) as a paid-tier perk — rewards commitment without punishing entry sellers.',
                },
                {
                  channel: 'WhatsApp direct connect',
                  wallet: 'Unlimited, unmetered — funded wallet alone unlocks it. No per-click cost, ever.',
                  sub: 'Same — one flat low fee for unlimited access. No cap, no per-lead metering, on either model.',
                },
                {
                  channel: 'Consultation request ("the lead")',
                  wallet: 'Flat ₹10 per lead delivered, deducted from wallet the moment it lands in her Enquiries — regardless of whether it converts. WE Bohra\'s job ends at delivering a qualified lead.',
                  sub: 'Same flat ₹10-per-lead — a plan fee doesn\'t change who\'s responsible for converting it, so this stays consistent across both models.',
                },
                {
                  channel: 'Overall pricing shape',
                  wallet: 'Zero fixed cost. She only ever pays a % of money she\'s already received — cannot go into debt to WE Bohra.',
                  sub: 'A fixed monthly bill regardless of sales — real risk for unpredictable income. Only worth offering once her own wallet data proves it\'d genuinely save her money.',
                },
              ].map((r) => (
                <tr key={r.channel} className="align-top">
                  <td className="border-b border-ink-soft/10 px-4 py-4 font-semibold text-ink">{r.channel}</td>
                  <td className="border-b border-ink-soft/10 px-4 py-4 text-[12.5px] text-ink-soft">{r.wallet}</td>
                  <td className="border-b border-ink-soft/10 px-4 py-4 text-[12.5px] text-ink-soft">{r.sub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-2xl bg-navy p-6 text-ivory">
          <h4 className="mb-2 font-heading text-base font-semibold text-white">Two things this rules out, on purpose</h4>
          <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-[#D7DEEA]">
            <li>No per-click or per-lead metering on WhatsApp direct connect, at any billing mode — an earlier draft of this audit suggested a monthly cap here; dropped, since it creates exactly the unpredictable-bill risk this audience can least afford.</li>
            <li>No charge on Basic-tier phone/email reveal, at any billing mode — it stays the free on-ramp for the smallest, most cautious sellers. Tracking it (at zero cost to her) still happens regardless, purely for WE Bohra&apos;s own visibility.</li>
          </ul>
        </div>

        <footer className="mt-9 text-center text-xs text-ink-soft">
          WE Bohra — Interaction &amp; Monetization Audit · temporary stakeholder preview, 2026-09-05 · every row checked
          directly against the current codebase
        </footer>
      </div>
    </div>
  );
}
