'use client';

import { useEffect, useState } from 'react';
import { ScrollText, Save } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton } from '@/components/skeleton';

type LegalPage = {
  id: number;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
};

/**
 * /admin/legal-pages — real, editable Privacy/Terms/Shipping & Returns
 * content (2026-09-06, marketplace-completeness scan) instead of
 * hardcoded pages needing a deploy to change. Plain text only — no rich
 * text/HTML input, see legalPages' own schema comment for why.
 */
export default function AdminLegalPagesPage() {
  const [pages, setPages] = useState<LegalPage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/admin/legal-pages')
      .then((res) => res.json())
      .then((data) => {
        setPages(data.pages ?? []);
        if (data.pages?.length) selectPage(data.pages[0]);
      });
  }, []);

  function selectPage(page: LegalPage) {
    setSelected(page.slug);
    setTitle(page.title);
    setContent(page.content);
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authFetch(`/api/admin/legal-pages/${selected}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.content?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      setPages((prev) => prev?.map((p) => (p.slug === selected ? data.page : p)) ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (pages === null) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold text-ink">
          <ScrollText className="h-6 w-6 text-navy" strokeWidth={1.75} />
          Legal Pages
        </h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          What actually shows on /privacy, /terms, and /shipping-returns — edited here, live the
          moment you save, no deploy needed.
        </p>
      </div>

      <div className="flex gap-2 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5 w-fit">
        {pages.map((page) => (
          <button
            key={page.slug}
            onClick={() => selectPage(page)}
            className={`rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
              selected === page.slug ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
            }`}
          >
            {page.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink-soft">Page title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputStyles} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-body text-xs font-medium text-ink-soft">
            Content — plain text, leave a blank line between paragraphs
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className={`${inputStyles} font-mono text-xs leading-relaxed`}
          />
        </label>
        {error && <p className="font-body text-xs text-red-700">{error}</p>}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className={buttonStyles('primary', 'sm')}>
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saving ? 'Saving…' : 'Save & publish'}
          </button>
          {saved && <span className="font-body text-xs text-teal-deep">Saved — live now.</span>}
        </div>
      </div>
    </div>
  );
}
