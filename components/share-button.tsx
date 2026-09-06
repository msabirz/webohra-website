'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

/**
 * Native share sheet where available (most mobile browsers); clipboard
 * copy everywhere else, including desktop Chrome/Firefox which don't
 * implement navigator.share. Purely client-side — no backend involved,
 * the URL is already public (2026-09-06, marketplace-completeness scan).
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // She cancelled the share sheet — not an error, do nothing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — nothing more to fall back to here.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={
        className ??
        'flex items-center gap-1.5 rounded-full bg-ivory-deep px-3.5 py-1.5 font-body text-sm font-medium text-ink-soft transition hover:bg-ivory hover:text-ink'
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Share2 className="h-3.5 w-3.5" strokeWidth={2} />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
