'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { FolderTree, Plus, X, ListTree } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton } from '@/components/skeleton';

type ListingType = 'physical_product' | 'local_service' | 'remote_service';
type Subcategory = { id: number; name: string; slug: string; listingType: ListingType; active: boolean };
type Category = { id: number; name: string; slug: string; active: boolean; subcategories: Subcategory[] };

const TYPE_LABEL: Record<ListingType, string> = {
  physical_product: 'Physical product',
  local_service: 'Local service',
  remote_service: 'Remote service',
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [subcategoryFormFor, setSubcategoryFormFor] = useState<number | null>(null);

  async function load() {
    const res = await authFetch('/api/admin/categories');
    const data = await res.json();
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleCategoryActive(cat: Category) {
    await authFetch(`/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !cat.active }),
    });
    load();
  }

  async function toggleSubcategoryActive(sub: Subcategory) {
    await authFetch(`/api/admin/subcategories/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !sub.active }),
    });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Categories</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            FR-12/FR-18: create and deactivate categories and subcategories — no deploy needed. A
            subcategory&apos;s type decides physical_product/local_service/remote_service for every
            product under it.
          </p>
        </div>
        <button onClick={() => setNewCategoryOpen(true)} className={buttonStyles('accent', 'sm')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add category
        </button>
      </div>

      {categories === null ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FolderTree className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
                  <p className="font-heading text-sm font-semibold text-ink">{cat.name}</p>
                  {!cat.active && (
                    <span className="rounded-full bg-ink-soft/10 px-2 py-0.5 font-body text-[11px] text-ink-soft">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSubcategoryFormFor(subcategoryFormFor === cat.id ? null : cat.id)}
                    className={buttonStyles('ghost', 'sm')}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Subcategory
                  </button>
                  <button onClick={() => toggleCategoryActive(cat)} className={buttonStyles('secondary', 'sm')}>
                    {cat.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {cat.subcategories.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between rounded-xl bg-ivory-deep/60 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="font-body text-sm text-ink">{sub.name}</p>
                      <p className="font-body text-xs text-ink-soft">{TYPE_LABEL[sub.listingType]}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!sub.active && (
                        <span className="rounded-full bg-ink-soft/10 px-2 py-0.5 font-body text-[11px] text-ink-soft">
                          Inactive
                        </span>
                      )}
                      <Link
                        href={`/admin/categories/${sub.id}/fields`}
                        className="flex items-center gap-1 font-body text-xs font-medium text-navy hover:underline"
                      >
                        <ListTree className="h-3.5 w-3.5" strokeWidth={2} />
                        Fields
                      </Link>
                      <button
                        onClick={() => toggleSubcategoryActive(sub)}
                        className="font-body text-xs font-medium text-navy hover:underline"
                      >
                        {sub.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
                {cat.subcategories.length === 0 && (
                  <p className="font-body text-xs text-ink-soft">No subcategories yet.</p>
                )}
              </div>

              {subcategoryFormFor === cat.id && (
                <NewSubcategoryForm
                  categoryId={cat.id}
                  onDone={() => {
                    setSubcategoryFormFor(null);
                    load();
                  }}
                  onCancel={() => setSubcategoryFormFor(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {newCategoryOpen && (
        <NewCategoryModal
          onClose={() => setNewCategoryOpen(false)}
          onDone={() => {
            setNewCategoryOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewSubcategoryForm({
  categoryId,
  onDone,
  onCancel,
}: {
  categoryId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [listingType, setListingType] = useState<ListingType>('physical_product');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, name, listingType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.name?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-ink-soft/20 p-3">
      <div className="flex flex-1 flex-col gap-1">
        <label className="font-body text-xs text-ink-soft">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={inputStyles} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-body text-xs text-ink-soft">Type</label>
        <select value={listingType} onChange={(e) => setListingType(e.target.value as ListingType)} className={inputStyles}>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={submitting} className={buttonStyles('accent', 'sm')}>
        {submitting ? 'Saving…' : 'Add'}
      </button>
      <button type="button" onClick={onCancel} className={buttonStyles('ghost', 'sm')}>
        Cancel
      </button>
      {error && <p className="w-full font-body text-xs text-red-700">{error}</p>}
    </form>
  );
}

function NewCategoryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.name?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">New category</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-ivory-deep hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          required
          autoFocus
          className={inputStyles}
        />
        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Create category'}
        </button>
      </form>
    </div>
  );
}
