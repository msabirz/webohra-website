'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { ArrowUp, ArrowDown, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { ImageManager } from '@/components/seller/image-manager';
import { Skeleton } from '@/components/skeleton';

type Variant = {
  id: number;
  name: string;
  price: string;
  stockQuantity: number | null;
  sortOrder: number;
};

/**
 * "A few different types" — Manda ₹40, Chapati ₹35, Butter Naan ₹60 —
 * instead of the one Price field a simple listing uses. Self-fetching,
 * same pattern as ImageManager: only usable once the listing has an id.
 * Each variant gets its own name/price/stock and its own photo manager
 * (the exact same ImageManager component, just scoped via variantId).
 */
export function VariantManager({ listingId }: { listingId: number }) {
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`/api/listings/${listingId}/variants`);
    const data = await res.json();
    setVariants(data.variants ?? []);
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(variant: Variant) {
    if (!confirm(`Remove "${variant.name}"? This can't be undone.`)) return;
    await authFetch(`/api/listings/${listingId}/variants/${variant.id}`, { method: 'DELETE' });
    if (expandedId === variant.id) setExpandedId(null);
    load();
  }

  async function move(index: number, direction: -1 | 1) {
    if (!variants) return;
    const next = [...variants];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setVariants(next);
    await authFetch(`/api/listings/${listingId}/variants/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((v) => v.id) }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {variants === null ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {variants.map((variant, i) => (
            <div key={variant.id} className="rounded-xl border border-ink-soft/10 bg-white">
              <div className="flex items-center justify-between gap-3 p-3">
                <button
                  onClick={() => setExpandedId(expandedId === variant.id ? null : variant.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {expandedId === variant.id ? (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0 text-ink-soft" strokeWidth={2} />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-soft" strokeWidth={2} />
                  )}
                  <span className="truncate font-body text-sm font-medium text-ink">{variant.name}</span>
                  <span className="shrink-0 font-body text-sm font-semibold text-navy">
                    ₹{Number(variant.price).toLocaleString('en-IN')}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === variants.length - 1}
                    aria-label="Move down"
                    className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => remove(variant)}
                    aria-label="Remove type"
                    className="rounded-full p-1.5 text-ink-soft transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              {expandedId === variant.id && (
                <div className="border-t border-ink-soft/10 p-3">
                  <EditVariantForm
                    listingId={listingId}
                    variant={variant}
                    onSaved={(updated) => setVariants((prev) => prev?.map((v) => (v.id === updated.id ? updated : v)) ?? null)}
                  />
                  <p className="mb-2 mt-4 font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Photos of {variant.name}
                  </p>
                  <ImageManager listingId={listingId} variantId={variant.id} />
                </div>
              )}
            </div>
          ))}
          {variants.length === 0 && !addOpen && (
            <p className="rounded-xl bg-ivory-deep/40 p-4 text-center font-body text-sm text-ink-soft">
              No types added yet — add your first one below.
            </p>
          )}
        </div>
      )}

      {!addOpen ? (
        <button type="button" onClick={() => setAddOpen(true)} className={buttonStyles('secondary', 'sm', 'self-start')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add another type
        </button>
      ) : (
        <AddVariantForm
          listingId={listingId}
          onDone={() => {
            setAddOpen(false);
            load();
          }}
          onCancel={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function EditVariantForm({
  listingId,
  variant,
  onSaved,
}: {
  listingId: number;
  variant: Variant;
  onSaved: (variant: Variant) => void;
}) {
  const [name, setName] = useState(variant.name);
  const [price, setPrice] = useState(variant.price);
  const [stockQuantity, setStockQuantity] = useState(variant.stockQuantity != null ? String(variant.stockQuantity) : '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await authFetch(`/api/listings/${listingId}/variants/${variant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price: Number(price),
        stockQuantity: stockQuantity === '' ? null : Number(stockQuantity),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.issues?.name?.[0] ?? data.issues?.price?.[0] ?? data.error ?? 'Could not save.');
      return;
    }
    onSaved(data.variant);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
        <label className="font-body text-xs text-ink-soft">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inputStyles} />
      </div>
      <div className="flex w-28 flex-col gap-1">
        <label className="font-body text-xs text-ink-soft">Price (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className={inputStyles}
        />
      </div>
      <div className="flex w-24 flex-col gap-1">
        <label className="font-body text-xs text-ink-soft">Stock</label>
        <input
          type="number"
          min="0"
          step="1"
          value={stockQuantity}
          onChange={(e) => setStockQuantity(e.target.value)}
          placeholder="—"
          className={inputStyles}
        />
      </div>
      <button type="submit" className={buttonStyles('secondary', 'sm')}>
        {saved ? 'Saved ✓' : 'Save'}
      </button>
      {error && <p className="w-full font-body text-xs text-red-700">{error}</p>}
    </form>
  );
}

function AddVariantForm({
  listingId,
  onDone,
  onCancel,
}: {
  listingId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/listings/${listingId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          price: Number(price),
          stockQuantity: stockQuantity === '' ? undefined : Number(stockQuantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.name?.[0] ?? data.issues?.price?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-dashed border-ink-soft/25 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
          <label className="font-body text-xs text-ink-soft">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Butter Naan"
            required
            autoFocus
            className={inputStyles}
          />
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label className="font-body text-xs text-ink-soft">Price (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="60"
            required
            className={inputStyles}
          />
        </div>
        <div className="flex w-24 flex-col gap-1">
          <label className="font-body text-xs text-ink-soft">Stock</label>
          <input
            type="number"
            min="0"
            step="1"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            placeholder="—"
            className={inputStyles}
          />
        </div>
      </div>
      {error && <p className="font-body text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className={buttonStyles('accent', 'sm')}>
          {submitting ? 'Adding…' : 'Add type'}
        </button>
        <button type="button" onClick={onCancel} className={buttonStyles('ghost', 'sm')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
