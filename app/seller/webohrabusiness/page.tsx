import Link from 'next/link';

/**
 * TEMPORARY stakeholder-preview page — 2026-09-05, rewritten crisp/short
 * for an exec read. Public, no auth, not linked from the live site.
 * Full rationale/history for every line here lives in the
 * webohra-fulfillment-subscriptions-phases memory backlog, not on this
 * page on purpose.
 */

type Row = { channel: string; charge: string; status: 'live' | 'ready' | 'free' };

const ROWS: Row[] = [
  { channel: 'Product sale — paid online', charge: '10% commission', status: 'live' },
  { channel: 'Product sale — COD / cash', charge: '10% commission', status: 'ready' },
  { channel: 'WhatsApp Connect', charge: '₹20, verified chat', status: 'ready' },
  { channel: 'WhatsApp Lead (service)', charge: '₹35, portal request', status: 'ready' },
  { channel: 'Delhivery shipping', charge: 'real cost recovered', status: 'ready' },
  { channel: 'Bonus-category sale', charge: '15% commission', status: 'ready' },
  { channel: 'Fixed subscription plan', charge: 'flat fee', status: 'ready' },
  { channel: 'Phone / email reveal (entry tier)', charge: 'always free', status: 'free' },
];

const STATUS: Record<Row['status'], { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-teal/15 text-teal-deep' },
  ready: { label: 'Fix ready', cls: 'bg-gold-soft/40 text-[#5C4415]' },
  free: { label: 'Free by design', cls: 'bg-ink-soft/10 text-ink-soft' },
};

export default function WeBohraBusinessAuditPage() {
  return (
    <div className="min-h-screen bg-ivory font-body text-ink">
      <nav className="flex items-center justify-between border-b border-ink-soft/15 bg-white px-6 py-4">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-navy-deep">
          <span className="h-2 w-2 rounded-full bg-gold" />
          WE Bohra
        </div>
        <Link href="/seller/pricing" className="text-sm font-semibold text-ink-soft hover:text-navy">
          ← Pricing
        </Link>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-9">
        <div className="mb-6 rounded-lg border border-gold/50 bg-gold-soft/20 px-4 py-2 text-center text-xs font-semibold text-ink-soft">
          Preview — not live
        </div>

        <h1 className="mb-4 font-heading text-2xl font-bold text-navy-deep">Is this worth doing?</h1>

        <div className="mb-7 rounded-2xl bg-navy p-6 text-white">
          <p className="text-[16px] font-semibold leading-snug">
            Yes. Today WE Bohra earns from 1 of 8 buyer-seller touchpoints. A designed, not-yet-built fix switches on
            6 more — with nothing added to what the buyer pays.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            ['1 / 8', 'live today'],
            ['6', 'fix ready, unbuilt'],
            ['₹0', 'added to buyer cost'],
          ].map(([num, label]) => (
            <div key={label} className="rounded-2xl border border-ink-soft/15 bg-white p-4 text-center">
              <div className="font-heading text-2xl font-bold text-navy-deep">{num}</div>
              <div className="text-[11.5px] text-ink-soft">{label}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 overflow-hidden rounded-xl border border-ink-soft/15 bg-white">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-4 py-2.5 font-bold">Channel</th>
                <th className="px-4 py-2.5 font-bold">Charge</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.channel} className={i % 2 === 1 ? 'bg-ivory/60' : ''}>
                  <td className="border-t border-ink-soft/10 px-4 py-2.5 font-semibold">{row.channel}</td>
                  <td className="border-t border-ink-soft/10 px-4 py-2.5 text-ink-soft">{row.charge}</td>
                  <td className="border-t border-ink-soft/10 px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${STATUS[row.status].cls}`}>
                      {STATUS[row.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-2 rounded-xl border border-ink-soft/15 bg-white p-5 text-[13px] text-ink-soft">
          <b className="text-ink">How WhatsApp gets verified:</b> chats route through one WE Bohra number instead of
          the seller&apos;s personal one — the same call-tracking principle Sulekha/JustDial use, applied to chat.
          Wallet-deducted only once WhatsApp itself confirms delivery.
        </div>

        <footer className="mt-8 text-center text-xs text-ink-soft">Preview, 2026-09-05</footer>
      </div>
    </div>
  );
}
