'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Archive, ArchiveRestore, X } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { Skeleton } from '@/components/skeleton';

type FieldType = 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'textarea' | 'image';

type SubcategoryField = {
  id: number;
  label: string;
  fieldKey: string;
  fieldType: FieldType;
  required: boolean;
  options: string[] | null;
  sortOrder: number;
  active: boolean;
};

type Subcategory = { id: number; name: string; categoryName?: string };

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select (one choice)',
  multi_select: 'Multi-select (several choices)',
  boolean: 'Yes/No',
  textarea: 'Long text',
  image: 'Photo',
};

/**
 * FR-17's actual field-builder — the Admin-Panel half of the
 * admin-configurable listing schema. Lives at /admin/categories/[id]/fields
 * where [id] is a *subcategory* id (namespaced under /categories/ since
 * that's where an admin already is when she clicks in from the Fields link
 * on a subcategory row).
 */
export default function SubcategoryFieldsPage() {
  const params = useParams<{ id: string }>();
  const subcategoryId = Number(params.id);

  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [fields, setFields] = useState<SubcategoryField[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadFields = useCallback(async () => {
    const res = await authFetch(`/api/admin/subcategories/${subcategoryId}/fields`);
    const data = await res.json();
    setFields(data.fields ?? []);
  }, [subcategoryId]);

  useEffect(() => {
    authFetch('/api/admin/categories')
      .then((res) => res.json())
      .then((data) => {
        for (const cat of data.categories ?? []) {
          const sub = cat.subcategories?.find((s: { id: number }) => s.id === subcategoryId);
          if (sub) {
            setSubcategory({ id: sub.id, name: sub.name, categoryName: cat.name });
            break;
          }
        }
      });
    loadFields();
  }, [subcategoryId, loadFields]);

  async function toggleActive(field: SubcategoryField) {
    const nextActive = !field.active;
    if (
      field.active &&
      !confirm(
        `Archive "${field.label}"? Sellers won't see it on new or edited listings, but anything already entered for it on existing listings stays saved and visible — nothing is deleted. You can restore it any time.`,
      )
    ) {
      return;
    }
    setFields((prev) => prev?.map((f) => (f.id === field.id ? { ...f, active: nextActive } : f)) ?? null);
    await authFetch(`/api/admin/subcategories/${subcategoryId}/fields/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: nextActive }),
    });
  }

  async function toggleRequired(field: SubcategoryField) {
    const nextRequired = !field.required;
    setFields((prev) => prev?.map((f) => (f.id === field.id ? { ...f, required: nextRequired } : f)) ?? null);
    await authFetch(`/api/admin/subcategories/${subcategoryId}/fields/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ required: nextRequired }),
    });
  }

  // Only active fields have a meaningful order (they're the only ones a
  // seller ever sees, in this order) — reordering operates on just that
  // subset, and only their ids go in the reorder call; archived fields
  // simply keep whatever sortOrder they last had.
  async function move(activeIndex: number, direction: -1 | 1) {
    if (!fields) return;
    const active = fields.filter((f) => f.active);
    const target = activeIndex + direction;
    if (target < 0 || target >= active.length) return;
    [active[activeIndex], active[target]] = [active[target], active[activeIndex]];
    const byId = new Map(active.map((f, i) => [f.id, i]));
    setFields((prev) => prev?.map((f) => (byId.has(f.id) ? active[byId.get(f.id)!] : f)) ?? null);
    await authFetch(`/api/admin/subcategories/${subcategoryId}/fields/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: active.map((f) => f.id) }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/categories" className="mb-2 flex items-center gap-1.5 font-body text-xs text-ink-soft hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Categories
        </Link>
        <h1 className="font-heading text-2xl font-semibold text-ink">
          {subcategory ? `${subcategory.name} — fields` : 'Fields'}
        </h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          What a seller fills in for this subcategory, beyond title/description/price/photos — no
          deploy needed to add, edit, or archive one.
        </p>
      </div>

      {fields === null ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {fields.filter((f) => f.active).map((field, i, activeFields) => (
            <div
              key={field.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-body text-sm font-medium text-ink">
                  {field.label}
                  <button
                    onClick={() => toggleRequired(field)}
                    title="Click to toggle"
                    className={`rounded-full px-2 py-0.5 font-body text-[10px] font-semibold transition ${
                      field.required
                        ? 'bg-gold/20 text-gold-soft hover:bg-gold/30'
                        : 'bg-ink-soft/10 text-ink-soft hover:bg-ink-soft/20'
                    }`}
                  >
                    {field.required ? 'Required' : 'Optional'}
                  </button>
                </p>
                <p className="font-body text-xs text-ink-soft">
                  {TYPE_LABEL[field.fieldType]}
                  {field.options?.length ? ` — ${field.options.join(', ')}` : ''}
                </p>
              </div>
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
                  disabled={i === activeFields.length - 1}
                  aria-label="Move down"
                  className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  onClick={() => toggleActive(field)}
                  aria-label="Archive field"
                  title="Archive — sellers stop seeing it, but nothing already entered is deleted"
                  className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
                >
                  <Archive className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
          {fields.filter((f) => f.active).length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
              No fields yet — sellers just get title/description/price/photos for this subcategory.
            </p>
          )}

          {fields.some((f) => !f.active) && (
            <details className="mt-2 rounded-2xl bg-ivory-deep/40 p-4">
              <summary className="cursor-pointer font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Archived fields ({fields.filter((f) => !f.active).length})
              </summary>
              <div className="mt-3 flex flex-col gap-2.5">
                {fields
                  .filter((f) => !f.active)
                  .map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white p-3.5 opacity-70 ring-1 ring-ink-soft/5"
                    >
                      <div className="min-w-0">
                        <p className="font-body text-sm font-medium text-ink">{field.label}</p>
                        <p className="font-body text-xs text-ink-soft">
                          {TYPE_LABEL[field.fieldType]}
                          {field.options?.length ? ` — ${field.options.join(', ')}` : ''} · values already entered
                          for it are kept
                        </p>
                      </div>
                      <button
                        onClick={() => toggleActive(field)}
                        aria-label="Restore field"
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs font-medium text-navy transition hover:bg-navy/5"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={2} />
                        Restore
                      </button>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}

      {!addOpen ? (
        <button onClick={() => setAddOpen(true)} className={buttonStyles('accent', 'sm', 'self-start')}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add field
        </button>
      ) : (
        <AddFieldForm
          subcategoryId={subcategoryId}
          onDone={() => {
            setAddOpen(false);
            loadFields();
          }}
          onCancel={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function AddFieldForm({
  subcategoryId,
  onDone,
  onCancel,
}: {
  subcategoryId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsOptions = fieldType === 'select' || fieldType === 'multi_select';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const options = needsOptions
        ? optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
      const res = await authFetch(`/api/admin/subcategories/${subcategoryId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, fieldType, required, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.label?.[0] ?? data.issues?.options?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5">
      <div className="flex items-start justify-between">
        <p className="font-heading text-sm font-semibold text-ink">New field</p>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-full p-1 text-ink-soft hover:bg-ivory-deep hover:text-ink">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="font-body text-xs text-ink-soft">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Fabric/Material"
            required
            autoFocus
            className={inputStyles}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-body text-xs text-ink-soft">Type</label>
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)} className={inputStyles}>
            {Object.entries(TYPE_LABEL).map(([value, typeLabel]) => (
              <option key={value} value={value}>
                {typeLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsOptions && (
        <div className="flex flex-col gap-1">
          <label className="font-body text-xs text-ink-soft">Options — comma-separated</label>
          <input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="e.g. Hand embroidery, Zari, Mirror work, Plain/None"
            required
            className={inputStyles}
          />
        </div>
      )}

      <label className="flex items-center gap-2 font-body text-sm text-ink">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
        />
        Required — a seller can&apos;t publish without filling this in
      </label>

      {error && <p className="font-body text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className={buttonStyles('accent', 'sm')}>
          {submitting ? 'Saving…' : 'Add field'}
        </button>
        <button type="button" onClick={onCancel} className={buttonStyles('ghost', 'sm')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
