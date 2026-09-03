'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Briefcase, ImagePlus, Link2, Loader2, Pencil, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { RowListSkeleton } from '@/components/skeleton';

type PortfolioItem = {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const EMPTY_FORM = { title: '', description: '', link: '', imageUrl: '' };

/**
 * /seller/portfolio — Fulfillment & Subscriptions redesign, Phase 6. Any
 * seller can build one; it only ever renders on a service listing's detail
 * page (see ServiceDetailView) — a product seller filling this in just
 * won't see it surfaced anywhere yet, which is fine, not an error state to
 * handle here.
 */
export default function SellerPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await authFetch('/api/sellers/portfolio');
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? '',
      link: item.link ?? '',
      imageUrl: item.imageUrl ?? '',
    });
    setError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleImageChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, or WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Photo must be under 8MB.');
      return;
    }
    setUploading(true);
    try {
      const presignRes = await authFetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, purpose: 'portfolio' }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setError(presignData.error ?? 'Could not start the upload.');
        return;
      }
      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setError('Upload to storage failed. Try again.');
        return;
      }
      setForm((prev) => ({ ...prev, imageUrl: presignData.publicUrl }));
    } catch (err) {
      console.error('R2 upload PUT failed:', err);
      setError('Could not reach storage to upload this photo — check the browser console/Network tab for details.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await authFetch(editingId ? `/api/sellers/portfolio/${editingId}` : '/api/sellers/portfolio', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          const errs: Record<string, string> = {};
          for (const key of Object.keys(data.issues)) errs[key] = data.issues[key]?.[0];
          setFieldErrors(errs);
        } else {
          setError(data.error ?? 'Could not save this item.');
        }
        return;
      }
      closeForm();
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(id: number) {
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
    await authFetch(`/api/sellers/portfolio/${id}`, { method: 'DELETE' });
    load();
  }

  async function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await authFetch('/api/sellers/portfolio/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Portfolio</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Past work a buyer can browse before booking — shows up on your service listings, below the details.
          </p>
        </div>
        {!formOpen && (
          <button onClick={openAdd} className={buttonStyles('primary', 'md', 'w-fit')}>
            Add item
          </button>
        )}
      </div>

      {formOpen && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-ink">{editingId ? 'Edit item' : 'Add item'}</h2>
            <button onClick={closeForm} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="portfolio-title" className="font-body text-sm font-medium text-ink">
              Title
            </label>
            <input
              id="portfolio-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. 3-day wedding mehndi package"
              className={inputStyles}
            />
            {fieldErrors.title && <p className="font-body text-xs text-red-700">{fieldErrors.title}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="portfolio-description" className="font-body text-sm font-medium text-ink">
              Description (optional)
            </label>
            <textarea
              id="portfolio-description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="What did this involve? A line or two is enough."
              rows={2}
              className={inputStyles}
            />
            {fieldErrors.description && <p className="font-body text-xs text-red-700">{fieldErrors.description}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="portfolio-link" className="font-body text-sm font-medium text-ink">
              Link (optional)
            </label>
            <input
              id="portfolio-link"
              value={form.link}
              onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
              placeholder="https://…"
              className={inputStyles}
            />
            {fieldErrors.link && <p className="font-body text-xs text-red-700">{fieldErrors.link}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-body text-sm font-medium text-ink">Photo (optional)</p>
            {form.imageUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="" className="h-32 w-32 rounded-xl object-cover ring-1 ring-ink-soft/10" />
                <button
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-ivory shadow-sm"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-soft/20 text-ink-soft transition hover:border-navy/40 hover:text-navy"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                ) : (
                  <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
                )}
                <span className="font-body text-xs">{uploading ? 'Uploading…' : 'Add photo'}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              className="hidden"
              onChange={(e) => handleImageChange(e.target.files?.[0])}
            />
          </div>

          {error && <p className="font-body text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting || !form.title.trim()} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add item'}
            </button>
            <button onClick={closeForm} className={buttonStyles('secondary', 'md')}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {items === null ? (
        <RowListSkeleton count={3} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Briefcase className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No portfolio items yet.</p>
          <p className="font-body text-xs text-ink-soft">Add a piece of past work to build trust before a booking.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-ink-soft/10" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-navy/5">
                  <Briefcase className="h-5 w-5 text-navy" strokeWidth={1.75} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-ink">{item.title}</p>
                {item.description && (
                  <p className="truncate font-body text-xs text-ink-soft">{item.description}</p>
                )}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-body text-xs text-navy underline underline-offset-2"
                  >
                    <Link2 className="h-3 w-3" strokeWidth={2} />
                    View
                  </a>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="rounded-full p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
