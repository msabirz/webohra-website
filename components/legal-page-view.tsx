'use client';

import { useEffect, useState } from 'react';
import { StaticPage } from '@/components/static-page';
import { Skeleton } from '@/components/skeleton';

/**
 * Renders one admin-managed legal page (2026-09-06) — content is plain
 * text, paragraphs separated by a blank line, split here rather than
 * trusting raw HTML from an admin textarea.
 */
export function LegalPageView({ slug, icon }: { slug: string; icon?: React.ElementType }) {
  const [page, setPage] = useState<{ title: string; content: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/legal-pages/${slug}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => data?.page && setPage(data.page));
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <p className="font-body text-sm text-ink-soft">This page isn&apos;t available right now.</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const paragraphs = page.content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return (
    <StaticPage title={page.title} icon={icon}>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {paragraph.trim()}
        </p>
      ))}
    </StaticPage>
  );
}
