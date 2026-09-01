'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Field, TextInput, TextArea, Select, SubmitButton } from '@/components/form';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { ImageManager } from '@/components/seller/image-manager';
import { DynamicFieldInput, type SubcategoryFieldDef } from '@/components/seller/dynamic-field-input';

type ListingType = 'physical_product' | 'local_service' | 'remote_service';

type Subcategory = {
  id: number;
  name: string;
  slug: string;
  listingType: ListingType;
  fields: SubcategoryFieldDef[];
};
type Category = { id: number; name: string; slug: string; subcategories: Subcategory[] };

export type ProductFormValues = {
  id?: number;
  slug?: string;
  subcategoryId: string;
  title: string;
  description: string;
  price: string;
  shippingMethod: 'self_managed' | 'delhivery';
  shippingEstimateText: string;
  stockQuantity: string;
  status?: 'draft' | 'active' | 'archived' | 'flagged' | 'removed';
  // FR-17's per-subcategory fields — keyed by fieldKey, shaped per each
  // field's own fieldType. Populated from GET /api/listings/[id]'s `fields`
  // array when editing, empty when creating.
  fieldValues?: Record<string, unknown>;
};

const emptyForm: ProductFormValues = {
  subcategoryId: '',
  title: '',
  description: '',
  price: '',
  shippingMethod: 'self_managed',
  shippingEstimateText: '',
  stockQuantity: '',
  fieldValues: {},
};

export function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [form, setForm] = useState<ProductFormValues>(initial ?? emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [dynamicErrors, setDynamicErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setServerError('Could not load categories. Refresh to try again.'))
      .finally(() => setLoadingCategories(false));
  }, []);

  const allSubcategories = useMemo(
    () => categories.flatMap((c) => c.subcategories.map((s) => ({ ...s, categoryName: c.name }))),
    [categories],
  );
  const selectedSubcategory = allSubcategories.find((s) => String(s.id) === form.subcategoryId);
  const needsShipping = selectedSubcategory?.listingType === 'physical_product';

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateFieldValue(fieldKey: string, value: unknown) {
    setForm((prev) => ({ ...prev, fieldValues: { ...prev.fieldValues, [fieldKey]: value } }));
  }

  // Image-type fields use this instead of updateFieldValue — an upload
  // finishing should behave like the main Photos gallery (saved the moment
  // it completes), not like typing into a text field (only saved on the
  // next explicit "Save changes"). `save()` is called with the merged
  // value directly rather than relying on `form` — setState hasn't been
  // committed yet in this same tick.
  function updateFieldValueAndSave(fieldKey: string, value: unknown) {
    const nextFieldValues = { ...(form.fieldValues ?? {}), [fieldKey]: value };
    setForm((prev) => ({ ...prev, fieldValues: nextFieldValues }));
    save({ fieldValues: nextFieldValues });
  }

  const STATIC_KEYS = new Set([
    'subcategoryId',
    'title',
    'description',
    'price',
    'shippingMethod',
    'shippingEstimateText',
    'stockQuantity',
  ]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save();
  }

  // Split out from the form's onSubmit so an image-type field's upload can
  // trigger a real save immediately, not just update local state — without
  // this, a photo that finished uploading LOOKS saved (its thumbnail shows
  // right away) but is silently lost if she never clicks "Save changes"
  // again, unlike the main Photos gallery which persists the moment each
  // upload completes. `overrides` lets a caller supply a value that hasn't
  // landed in `form` state yet (React batches setState, so reading `form`
  // in the same tick a photo finishes uploading would still see the old
  // fieldValues).
  async function save(overrides?: Partial<ProductFormValues>) {
    const current = { ...form, ...overrides };
    setServerError(null);
    setErrors({});
    setDynamicErrors({});
    setSubmitting(true);

    const payload = {
      subcategoryId: Number(current.subcategoryId),
      title: current.title,
      description: current.description,
      price: current.price,
      shippingMethod: needsShipping ? current.shippingMethod : 'self_managed',
      shippingEstimateText: needsShipping ? current.shippingEstimateText : undefined,
      stockQuantity: needsShipping && current.stockQuantity !== '' ? Number(current.stockQuantity) : null,
      fieldValues: current.fieldValues ?? {},
    };

    // Once this form has an id — whether it started in "edit" mode or got
    // here by saving a brand-new draft a moment ago — every further save is
    // an update. This is what lets "create" stay a single page: the first
    // save reveals Photos/Preview right here instead of navigating away.
    const isUpdate = Boolean(current.id);

    try {
      const res = await authFetch(isUpdate ? `/api/listings/${current.id}` : '/api/listings', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push('/seller/login');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (data.issues) {
          // Zod's flatten() gives { key: string[] }; lib/listing-fields.ts's
          // validateFieldValues gives { fieldKey: string } directly for the
          // dynamic half — normalized here rather than in two places.
          const fieldErrors: Partial<Record<keyof ProductFormValues, string>> = {};
          const dynErrors: Record<string, string> = {};
          for (const key of Object.keys(data.issues)) {
            const raw = data.issues[key];
            const message = Array.isArray(raw) ? raw[0] : raw;
            if (STATIC_KEYS.has(key)) {
              (fieldErrors as Record<string, string>)[key] = message;
            } else {
              dynErrors[key] = message;
            }
          }
          setErrors(fieldErrors);
          setDynamicErrors(dynErrors);
        } else {
          setServerError(data.error ?? 'Something went wrong. Please try again.');
        }
        return;
      }

      setForm((prev) => ({
        ...prev,
        id: data.listing.id,
        slug: data.listing.slug,
        status: data.listing.status,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setServerError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(status: 'draft' | 'active' | 'archived') {
    if (!form.id) return;
    setStatusBusy(true);
    setServerError(null);
    try {
      const res = await authFetch(`/api/listings/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? 'Could not update status.');
        return;
      }
      setForm((prev) => ({ ...prev, status: data.listing.status }));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    if (!confirm('Delete this product? This can\'t be undone.')) return;
    const res = await authFetch(`/api/listings/${form.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/seller/products');
    } else {
      const data = await res.json();
      setServerError(data.error ?? 'Could not delete this product.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {form.status && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <p className="mr-auto font-body text-sm text-ink-soft">
            Status: <span className="font-semibold text-ink">{STATUS_LABEL[form.status]}</span>
          </p>
          {form.slug && (
            <a
              href={`/collection/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles('secondary', 'sm')}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              Preview
            </a>
          )}
          {form.status !== 'active' && (
            <button disabled={statusBusy} onClick={() => setStatus('active')} className={buttonStyles('accent', 'sm')}>
              Publish
            </button>
          )}
          {form.status === 'active' && (
            <button disabled={statusBusy} onClick={() => setStatus('draft')} className={buttonStyles('secondary', 'sm')}>
              Unpublish
            </button>
          )}
          {form.status !== 'archived' && (
            <button disabled={statusBusy} onClick={() => setStatus('archived')} className={buttonStyles('secondary', 'sm')}>
              Archive
            </button>
          )}
          {form.status === 'archived' && (
            <button disabled={statusBusy} onClick={() => setStatus('draft')} className={buttonStyles('secondary', 'sm')}>
              Move to draft
            </button>
          )}
          <button onClick={handleDelete} className={buttonStyles('ghost', 'sm', 'text-red-600 hover:text-red-700')}>
            Delete
          </button>
        </div>
      )}

      {form.id && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="font-heading text-sm font-semibold text-ink">Photos</h2>
          <ImageManager listingId={form.id} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5"
        noValidate
      >
        <Field label="Category" htmlFor="subcategoryId" error={errors.subcategoryId}>
          <Select
            id="subcategoryId"
            name="subcategoryId"
            value={form.subcategoryId}
            onChange={(e) => update('subcategoryId', e.target.value)}
            required
            disabled={loadingCategories}
          >
            <option value="" disabled>
              {loadingCategories ? 'Loading…' : 'Select a category'}
            </option>
            {categories.map((category) => (
              <optgroup key={category.id} label={category.name}>
                {category.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field label="Title" htmlFor="title" error={errors.title}>
          <TextInput
            id="title"
            name="title"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Hand-embroidered dupatta"
            required
            minLength={3}
          />
        </Field>

        <Field label="Description" htmlFor="description" error={errors.description}>
          <TextArea
            id="description"
            name="description"
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Describe what you're offering…"
            required
            minLength={10}
          />
        </Field>

        <Field label="Price (₹)" htmlFor="price" error={errors.price}>
          <TextInput
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            placeholder="500"
            required
          />
        </Field>

        {selectedSubcategory && selectedSubcategory.fields.length > 0 && (
          <div className="flex flex-col gap-5 rounded-xl border border-ink-soft/10 bg-ivory-deep/40 p-4">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {selectedSubcategory.name} details
            </p>
            {selectedSubcategory.fields.map((field) => (
              <DynamicFieldInput
                key={field.id}
                field={field}
                value={form.fieldValues?.[field.fieldKey]}
                onChange={(value) =>
                  field.fieldType === 'image'
                    ? updateFieldValueAndSave(field.fieldKey, value)
                    : updateFieldValue(field.fieldKey, value)
                }
                error={dynamicErrors[field.fieldKey]}
                listingId={form.id}
              />
            ))}
          </div>
        )}

        {needsShipping && (
          <>
            <Field label="Stock on hand" htmlFor="stockQuantity" error={errors.stockQuantity} hint="Leave blank if you don't want to track inventory for this product.">
              <TextInput
                id="stockQuantity"
                name="stockQuantity"
                type="number"
                min="0"
                step="1"
                value={form.stockQuantity}
                onChange={(e) => update('stockQuantity', e.target.value)}
                placeholder="e.g. 20"
              />
            </Field>

            <Field label="Shipping" htmlFor="shippingMethod" error={errors.shippingMethod}>
              <Select
                id="shippingMethod"
                name="shippingMethod"
                value={form.shippingMethod}
                onChange={(e) => update('shippingMethod', e.target.value as ProductFormValues['shippingMethod'])}
              >
                <option value="self_managed">I&apos;ll ship it myself</option>
                <option value="delhivery">Ship via Delhivery</option>
              </Select>
            </Field>

            {form.shippingMethod === 'self_managed' && (
              <Field
                label="Delivery estimate"
                htmlFor="shippingEstimateText"
                error={errors.shippingEstimateText}
                hint="Shown to buyers as your own estimate — not tracked by WE Bohra."
              >
                <TextInput
                  id="shippingEstimateText"
                  name="shippingEstimateText"
                  value={form.shippingEstimateText}
                  onChange={(e) => update('shippingEstimateText', e.target.value)}
                  placeholder="e.g. Ships within 3-5 business days"
                  required
                />
              </Field>
            )}
          </>
        )}

        {serverError && <p className="text-sm text-red-700">{serverError}</p>}

        <SubmitButton disabled={submitting || loadingCategories}>
          {submitting
            ? 'Saving…'
            : saved
              ? 'Saved ✓'
              : form.id
                ? 'Save changes'
                : 'Save as draft'}
        </SubmitButton>
        {!form.id && (
          <p className="text-center font-body text-xs text-ink-soft">
            Saves as a draft first — photos and a preview link appear on this same page the
            moment it does, no need to go anywhere else.
          </p>
        )}
      </form>
    </div>
  );
}

const STATUS_LABEL: Record<NonNullable<ProductFormValues['status']>, string> = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
  flagged: 'Flagged',
  removed: 'Removed',
};
