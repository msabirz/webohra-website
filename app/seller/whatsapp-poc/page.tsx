'use client';

import { useEffect, useState } from 'react';

/**
 * TEMPORARY POC page (2026-09-05) — proves the real WhatsApp Business
 * Platform send→status pipeline end to end. Public, no auth, not linked
 * from the live site — same pattern as /seller/pricing and
 * /seller/webohrabusiness. Delete once the POC has done its job.
 */

type WhatsAppMessage = {
  id: number;
  toPhone: string;
  waMessageId: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  failureReason: string | null;
  createdAt: string;
  statusUpdatedAt: string;
};

const STATUS_COPY: Record<WhatsAppMessage['status'], { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'bg-ink-soft/15 text-ink-soft' },
  sent: { label: 'Sent — waiting for delivery', color: 'bg-gold-soft/40 text-[#5C4415]' },
  delivered: { label: 'Delivered — reached her phone', color: 'bg-navy/15 text-navy-deep' },
  read: { label: 'Read (or replied) — genuine connect confirmed', color: 'bg-teal/15 text-teal-deep' },
  failed: { label: 'Failed', color: 'bg-[#F7E4DE] text-[#8A3B26]' },
};

export default function WhatsAppPocPage() {
  const [toPhone, setToPhone] = useState('');
  const [message, setMessage] = useState<WhatsAppMessage | null>(null);
  const [isDev, setIsDev] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function poll() {
    const res = await fetch('/api/poc/whatsapp-connect');
    const data = await res.json();
    if (data.message) setMessage(data.message);
  }

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, []);

  async function send() {
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/poc/whatsapp-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setMessage(data.message);
      setIsDev(data.isDev);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory font-body text-ink">
      <div className="mx-auto max-w-2xl px-6 py-11">
        <div className="mb-6 rounded-lg border border-gold/50 bg-gold-soft/20 px-4 py-2 text-center text-xs font-semibold text-ink-soft">
          Temporary POC — proving real WhatsApp delivery/read tracking, not linked from the live site.
        </div>

        <h1 className="mb-2 font-heading text-2xl font-bold text-navy-deep">WhatsApp Connect — real tracking POC</h1>
        <p className="mb-6 text-[14px] text-ink-soft">
          Simulates a &quot;WhatsApp Connect&quot; click by sending a real message through the WhatsApp Business
          Platform, then polls for the genuine delivery/read status Meta&apos;s webhook reports back — the piece
          that&apos;s missing from today&apos;s wa.me deep link entirely.
        </p>

        {isDev === true && (
          <div className="mb-4 rounded-lg bg-gold-soft/30 px-4 py-3 text-[13px] text-[#5C4415]">
            Running in dev mode — no <code>WHATSAPP_PROVIDER</code> configured yet, so this logged to the server
            console instead of actually reaching WhatsApp. Status will stop at &quot;Sent&quot; since there&apos;s no
            real webhook to advance it. See <code>lib/whatsapp/index.ts</code> for setup steps.
          </div>
        )}

        <div className="mb-6 flex gap-3">
          <input
            value={toPhone}
            onChange={(e) => setToPhone(e.target.value)}
            placeholder="+919876543210 (a verified test recipient number)"
            className="flex-1 rounded-lg border border-ink-soft/20 px-4 py-2.5 text-sm"
          />
          <button
            onClick={send}
            disabled={sending || !toPhone}
            className="rounded-lg bg-navy px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Simulate Connect'}
          </button>
        </div>

        {error && <div className="mb-6 rounded-lg bg-[#F7E4DE] px-4 py-3 text-[13px] text-[#8A3B26]">{error}</div>}

        {message && (
          <div className="rounded-2xl border border-ink-soft/15 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-ink-soft">To {message.toPhone}</span>
              <span className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${STATUS_COPY[message.status].color}`}>
                {STATUS_COPY[message.status].label}
              </span>
            </div>
            <div className="text-[12px] text-ink-soft">
              wamid: <code>{message.waMessageId ?? '—'}</code>
            </div>
            <div className="text-[12px] text-ink-soft">
              Last updated: {new Date(message.statusUpdatedAt).toLocaleTimeString()}
            </div>
            {message.failureReason && (
              <div className="mt-2 text-[12px] text-[#8A3B26]">Reason: {message.failureReason}</div>
            )}
            <p className="mt-4 text-[11.5px] text-ink-soft">
              Polling every 2.5s — once you reply to the test message on your phone, this should flip to
              &quot;Read (or replied)&quot; automatically, proving the webhook round-trip works.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
