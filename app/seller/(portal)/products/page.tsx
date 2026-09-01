'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  PlusCircle,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Archive,
  Pencil,
  X,
} from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { TableSkeleton } from '@/components/skeleton';

type ProductStatus = 'draft' | 'active' | 'archived' | 'flagged' | 'removed';

type Product = {
  id: number;
  slug: string;
  title: string;
  // null = different types, no single price of its own (see listings.price's
  // own comment in db/schema.ts).
  price: string | null;
  status: ProductStatus;
  stockQuantity: number | null;
  categoryName: string;
  subcategoryName: string;
  listingType: 'physical_product' | 'local_service' | 'remote_service';
  coverImageUrl: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
  flagged: 'Flagged',
  removed: 'Removed',
};

const STATUS_CLASS: Record<ProductStatus, string> = {
  draft: 'bg-ink-soft/10 text-ink-soft',
  active: 'bg-teal/10 text-teal-deep',
  archived: 'bg-ink-soft/10 text-ink-soft',
  flagged: 'bg-gold/20 text-ink',
  removed: 'bg-red-100 text-red-700',
};

type Tab = 'all' | ProductStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'active', label: 'Published' },
  { key: 'archived', label: 'Archived' },
];

function toCsv(rows: Product[]): string {
  const header = ['Title', 'Category', 'Subcategory', 'Price', 'Stock', 'Status', 'Created'];
  const lines = rows.map((p) =>
    [
      p.title,
      p.categoryName,
      p.subcategoryName,
      p.price ?? 'Multiple types',
      p.stockQuantity ?? '',
      STATUS_LABEL[p.status],
      new Date(p.createdAt).toISOString().slice(0, 10),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  async function load() {
    const res = await authFetch('/api/listings/mine');
    const data = await res.json();
    setProducts(data.listings ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!products) return [];
    if (tab === 'all') return products;
    return products.filter((p) => p.status === tab);
  }, [products, tab]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetStatus(status: 'draft' | 'active' | 'archived') {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/listings/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not update the selected products.');
        return;
      }
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} product(s)? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/listings/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.blockedIds?.length) {
        setError(
          `${data.blockedIds.length} product(s) have order history and were archived instead of deleted.`,
        );
        await Promise.all(
          data.blockedIds.map((id: number) =>
            authFetch('/api/listings/bulk-status', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: [id], status: 'archived' }),
            }),
          ),
        );
      }
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = selected.size > 0 ? filtered.filter((p) => selected.has(p.id)) : filtered;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `we-bohra-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Products</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Add, edit, publish, and archive what you sell.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className={buttonStyles('secondary', 'sm')}>
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Export
          </button>
          <button onClick={() => setBulkUploadOpen(true)} className={buttonStyles('secondary', 'sm')}>
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            Bulk upload
          </button>
          <Link href="/seller/products/new" className={buttonStyles('accent', 'sm')}>
            <PlusCircle className="h-3.5 w-3.5" strokeWidth={2} />
            Add product
          </Link>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto rounded-full bg-white p-1.5 shadow-sm ring-1 ring-ink-soft/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSelected(new Set());
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 font-body text-sm font-medium transition ${
              tab === t.key ? 'bg-navy text-ivory' : 'text-ink-soft hover:bg-ivory-deep hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-navy px-4 py-3">
          <p className="mr-auto font-body text-sm font-medium text-ivory">
            {selected.size} selected
          </p>
          <button disabled={busy} onClick={() => bulkSetStatus('active')} className={buttonStyles('outline', 'sm')}>
            <Eye className="h-3.5 w-3.5" strokeWidth={2} />
            Publish
          </button>
          <button disabled={busy} onClick={() => bulkSetStatus('draft')} className={buttonStyles('outline', 'sm')}>
            <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
            Unpublish
          </button>
          <button disabled={busy} onClick={() => bulkSetStatus('archived')} className={buttonStyles('outline', 'sm')}>
            <Archive className="h-3.5 w-3.5" strokeWidth={2} />
            Archive
          </button>
          <button
            disabled={busy}
            onClick={bulkDelete}
            className={buttonStyles('outline', 'sm', 'hover:!bg-red-500/20')}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Delete
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">{error}</p>
      )}

      {products === null ? (
        <TableSkeleton columns={7} rows={5} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-ink-soft/5">
          <Package className="h-8 w-8 text-ink-soft/40" strokeWidth={1.5} />
          <p className="font-body text-sm text-ink-soft">No products here yet.</p>
          <Link href="/seller/products/new" className={buttonStyles('accent', 'sm')}>
            <PlusCircle className="h-3.5 w-3.5" strokeWidth={2} />
            Add your first product
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
          <table className="w-full min-w-[720px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
                  />
                </th>
                <th className="px-2 py-3">Product</th>
                <th className="px-2 py-3">Category</th>
                <th className="px-2 py-3">Price</th>
                <th className="px-2 py-3">Stock</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-ink-soft/5 last:border-0 hover:bg-ivory-deep/40">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/seller/products/${p.id}/edit`} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ivory-deep">
                        {p.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
                          <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-ink-soft/40" strokeWidth={1.5} />
                        )}
                      </span>
                      <span className="line-clamp-1 font-medium text-ink">{p.title}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-ink-soft">{p.subcategoryName}</td>
                  <td className="px-2 py-3 text-ink">
                    {p.price !== null ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Multiple types'}
                  </td>
                  <td className="px-2 py-3 text-ink-soft">
                    {p.listingType === 'physical_product'
                      ? (p.stockQuantity ?? '—')
                      : <span className="text-ink-soft/50">N/A</span>}
                  </td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Link
                      href={`/seller/products/${p.id}/edit`}
                      className="inline-flex items-center gap-1 font-medium text-navy hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bulkUploadOpen && <BulkUploadModal onClose={() => setBulkUploadOpen(false)} />}
    </div>
  );
}

function BulkUploadModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy/5">
              <Upload className="h-4.5 w-4.5 text-navy" strokeWidth={2} />
            </span>
            <h2 className="font-heading text-lg font-semibold text-ink">Bulk upload</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <p className="font-body text-sm text-ink-soft">
          Bulk product upload from a spreadsheet is coming soon — we&apos;re still working out the
          exact template with the Idara team. For now, use <strong>Export</strong> to download your
          current catalogue, or add products one at a time.
        </p>
        <button onClick={onClose} className={buttonStyles('secondary', 'md')}>
          Got it
        </button>
      </div>
    </div>
  );
}
