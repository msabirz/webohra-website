'use client';

import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, Settings2 } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { useSellerPortal } from '@/lib/seller-context';
import { Skeleton } from '@/components/skeleton';

type WalletTransaction = {
  id: number;
  type: 'topup' | 'commission_deduction' | 'admin_adjustment';
  amount: string;
  balanceAfter: string;
  reason: string | null;
  gatewayPaymentId: string | null;
  createdAt: string;
};

type Wallet = { balance: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(script);
  });
}

const TYPE_LABEL: Record<WalletTransaction['type'], string> = {
  topup: 'Top-up',
  commission_deduction: 'Commission',
  admin_adjustment: 'Admin adjustment',
};

const PRESET_AMOUNTS = [200, 500, 1000, 2000];

/**
 * /seller/wallet — Fulfillment & Subscriptions redesign, Phase 5. Real
 * money, real Razorpay sandbox order, real signature verification before a
 * single rupee is recorded — see app/api/sellers/wallet/{topup-order,verify}
 * and the webhook fallback at app/api/webhooks/razorpay. Usable by any
 * seller, not just one already on the recharge billing mode — she needs a
 * funded wallet to switch into recharge from /seller/subscription in the
 * first place, so this can't be gated behind that choice.
 */
export default function SellerWalletPage() {
  const { me } = useSellerPortal();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[] | null>(null);
  const [amount, setAmount] = useState<number | ''>(500);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCredited, setJustCredited] = useState<string | null>(null);

  async function load() {
    const res = await authFetch('/api/sellers/wallet');
    if (!res.ok) return;
    const data = await res.json();
    setWallet(data.wallet);
    setTransactions(data.transactions);
  }

  useEffect(() => {
    load();
  }, []);

  async function topUp() {
    if (!amount || amount < 100) {
      setError('Minimum top-up is ₹100');
      return;
    }
    if (amount > 25000) {
      setError('For amounts over ₹25,000, contact WeBohra support directly');
      return;
    }
    setError(null);
    setJustCredited(null);
    setPaying(true);
    try {
      const orderRes = await authFetch('/api/sellers/wallet/topup-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRupees: amount }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        // A validation failure here only ever has one possible field
        // (amount) — surface Zod's own specific message ("Minimum top-up
        // is ₹100" / "For amounts over ₹25,000...") instead of the generic
        // "Invalid input" the route returns as its top-level error.
        setError(orderData.issues?.amountRupees?.[0] ?? orderData.error ?? 'Could not start the payment.');
        setPaying(false);
        return;
      }

      await loadRazorpayScript();
      if (!window.Razorpay) {
        setError('Could not load the payment window. Check your connection and try again.');
        setPaying(false);
        return;
      }

      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.razorpayOrderId,
        name: 'WE Bohra',
        description: 'Wallet top-up',
        prefill: {
          name: me.user.name ?? undefined,
          email: me.user.email ?? undefined,
          contact: me.user.phone,
        },
        theme: { color: '#1B3A6B' },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await authFetch('/api/sellers/wallet/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setJustCredited(`₹${amount} added to your wallet.`);
            load();
          } else {
            setError(verifyData.error ?? 'Payment succeeded but could not be confirmed — contact WeBohra support.');
          }
          setPaying(false);
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      razorpay.open();
    } catch {
      setError('Something went wrong starting the payment. Try again.');
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Wallet</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Top up your balance here — it&apos;s what pay-as-you-go (recharge) plans run on. See{' '}
          <a href="/seller/subscription" className="text-navy underline underline-offset-2">
            Subscription
          </a>{' '}
          to switch a plan into recharge mode.
        </p>
      </div>

      {wallet === null ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl bg-navy p-6 text-ivory shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <WalletIcon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-ivory/60">Current balance</p>
              <p className="font-heading text-2xl font-semibold">₹{Number(wallet.balance).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="font-heading text-lg font-semibold text-ink">Top up</h2>

        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
                amount === preset ? 'bg-navy text-ivory' : 'bg-ivory-deep text-ink-soft hover:bg-ivory'
              }`}
            >
              ₹{preset}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="topup-amount" className="font-body text-xs font-medium text-ink-soft">
            Or enter an amount (₹100 – ₹25,000)
          </label>
          <input
            id="topup-amount"
            type="number"
            min={100}
            max={25000}
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full max-w-[200px] rounded-xl border border-ink-soft/15 px-3.5 py-2 font-body text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">{error}</p>}
        {justCredited && (
          <p className="rounded-xl bg-teal/10 px-4 py-2.5 font-body text-sm text-teal-deep">{justCredited}</p>
        )}

        <button onClick={topUp} disabled={paying} className={buttonStyles('primary', 'md', 'w-fit')}>
          {paying ? 'Opening payment…' : `Pay ₹${amount || 0}`}
        </button>
        <p className="font-body text-xs text-ink-soft">
          Sandbox payments only right now — no real money moves. Card: 4100 2800 0000 1007 (Visa) or 5500 6700 0000
          1002 (Mastercard), any future expiry/CVV.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-ink">Transaction history</h2>
        {transactions === null ? (
          <Skeleton className="h-40" />
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ink-soft/5">
            <WalletIcon className="h-7 w-7 text-ink-soft/40" strokeWidth={1.5} />
            <p className="font-body text-sm text-ink-soft">No transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Balance after</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isCredit = t.type === 'topup' || (t.type === 'admin_adjustment' && Number(t.amount) >= 0);
                  return (
                    <tr key={t.id} className="border-b border-ink-soft/5 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t.type === 'admin_adjustment' ? (
                            <Settings2 className="h-3.5 w-3.5 text-ink-soft" strokeWidth={2} />
                          ) : isCredit ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-teal-deep" strokeWidth={2} />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-600" strokeWidth={2} />
                          )}
                          {TYPE_LABEL[t.type]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium tabular-nums ${isCredit ? 'text-teal-deep' : 'text-red-600'}`}>
                        {isCredit ? '+' : '−'}₹{Math.abs(Number(t.amount)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">
                        ₹{Number(t.balanceAfter).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{t.reason ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
