'use client';

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ExternalLink, TrendingUp, X } from 'lucide-react';
import { Field, TextInput, TextArea, Select, SubmitButton } from '@/components/form';
import { authFetch } from '@/lib/session-client';
import { buttonStyles } from '@/lib/button-styles';
import { ImageManager } from '@/components/seller/image-manager';
import { VariantManager } from '@/components/seller/variant-manager';
import { DynamicFieldInput, type SubcategoryFieldDef } from '@/components/seller/dynamic-field-input';
import { useToast } from '@/components/toast-context';
import { scrollToFirstError } from '@/lib/form-error-focus';

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
  // undefined = not yet decided (a brand-new, unsaved listing — the
  // branching question shows). false = simple, one price (today's flow).
  // true = different types — price stays empty/unused, real prices live in
  // variants instead. Set from whether the fetched listing's own price is
  // null when editing (see the edit page's fetch).
  hasVariants?: boolean;
  // Fulfillment & Subscriptions redesign, Phase 2 — every field below is
  // optional and blank/off is exactly today's behavior, so an existing
  // listing that never touches this section keeps working unchanged.
  selfShipCharge: string;
  pickupEnabled: boolean;
  pickupAddressSource: 'seller' | 'office' | '';
  pickupLeadTimeHours: string;
  showAddressOnPdp: boolean;
  weight: string;
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
  selfShipCharge: '',
  pickupEnabled: false,
  pickupAddressSource: '',
  pickupLeadTimeHours: '',
  showAddressOnPdp: false,
  weight: '',
};

export function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [form, setForm] = useState<ProductFormValues>(initial ?? emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [dynamicErrors, setDynamicErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  // Set only when publishing is blocked by her subscription plan (the API
  // sends a `code` alongside `error` specifically for this — see
  // lib/subscriptions.ts's checkPublishGate) — a popup rather than the
  // same inline red text every other error gets, since this specific one
  // needs an actionable "go upgrade" link, not just an explanation
  // (2026-09-04, user's own ask).
  const [planGateMessage, setPlanGateMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  // Tracks whether the initial "she just created a brand-new draft, and
  // the Photos section only now exists" transition already got its
  // one-time auto-scroll (2026-09-04, user's own ask — "in second step
  // we ask for image, cant we ask this things in one form itself?"). This
  // is the pragmatic version: the create-then-attach-photos backend
  // sequence is unchanged (uploads genuinely need a real listing id
  // first), but the UI stops making that feel like a separate step — one
  // continuous scroll straight into the now-visible Photos section,
  // right where she left off, instead of a static page she'd otherwise
  // have to notice changed and scroll to herself.
  const scrolledToPhotos = useRef(false);
  useEffect(() => {
    if (form.id && !scrolledToPhotos.current && !initial?.id) {
      scrolledToPhotos.current = true;
      document.getElementById('photos-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [form.id, initial?.id]);

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

  const [convertError, setConvertError] = useState<string | null>(null);

  // The retroactive path: an already-saved simple listing, edited later to
  // add a second type. Her current price/photos become the first variant
  // (named here), the listing's own price goes null — one atomic server
  // call (see the route's own comment for why), not several the client
  // could leave half-done.
  async function convertToVariants() {
    const name = prompt(
      `Let's name what you already have — ₹${form.price}, with its current photos. What do you call it?`,
    );
    if (!name || !name.trim() || !form.id) return;
    setConvertError(null);
    const res = await authFetch(`/api/listings/${form.id}/convert-to-variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setConvertError(data.error ?? 'Could not switch to different types.');
      return;
    }
    setForm((prev) => ({ ...prev, hasVariants: true, price: '' }));
  }

  const STATIC_KEYS = new Set([
    'subcategoryId',
    'title',
    'description',
    'price',
    'shippingMethod',
    'shippingEstimateText',
    'stockQuantity',
    'selfShipCharge',
    'pickupEnabled',
    'pickupAddressSource',
    'pickupLeadTimeHours',
    'showAddressOnPdp',
    'weight',
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
      // Omitted entirely (not an empty string) when she's using different
      // types — the schema's price field is optional specifically so this
      // undefined key gets dropped by JSON.stringify, not coerced into a
      // "0 is not a valid price" error. See priceField's comment in
      // lib/validation.ts.
      price: current.hasVariants ? undefined : current.price,
      shippingMethod: needsShipping ? current.shippingMethod : 'self_managed',
      shippingEstimateText: needsShipping ? current.shippingEstimateText : undefined,
      stockQuantity:
        needsShipping && !current.hasVariants && current.stockQuantity !== ''
          ? Number(current.stockQuantity)
          : null,
      fieldValues: current.fieldValues ?? {},
      // Fulfillment & Subscriptions redesign, Phase 2 — only sent for
      // physical products, same gate as the rest of the shipping section.
      selfShipCharge: needsShipping && current.selfShipCharge !== '' ? Number(current.selfShipCharge) : undefined,
      pickupEnabled: needsShipping ? current.pickupEnabled : undefined,
      pickupAddressSource: needsShipping && current.pickupEnabled && current.pickupAddressSource ? current.pickupAddressSource : undefined,
      pickupLeadTimeHours:
        needsShipping && current.pickupEnabled && current.pickupLeadTimeHours !== ''
          ? Number(current.pickupLeadTimeHours)
          : undefined,
      showAddressOnPdp: needsShipping ? current.showAddressOnPdp : undefined,
      weight: needsShipping && current.weight !== '' ? Number(current.weight) : undefined,
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
          showToast('Please fix the highlighted field(s) before saving.', 'error');
          // Static fields are actual DOM inputs with matching ids;
          // dynamic (per-subcategory) fields render further down and
          // aren't part of this scroll target set yet — their errors
          // still show inline either way.
          scrollToFirstError(Object.keys(fieldErrors));
        } else {
          setServerError(data.error ?? 'Something went wrong. Please try again.');
          showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
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
      showToast(isUpdate ? 'Changes saved.' : 'Draft created — add photos below.', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setServerError('Could not reach the server. Check your connection and try again.');
      showToast('Could not reach the server. Check your connection and try again.', 'error');
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
        if (data.code) {
          setPlanGateMessage(data.error);
        } else {
          setServerError(data.error ?? 'Could not update status.');
          showToast(data.error ?? 'Could not update status.', 'error');
        }
        return;
      }
      setForm((prev) => ({ ...prev, status: data.listing.status }));
      showToast(`Marked as ${STATUS_LABEL[data.listing.status as keyof typeof STATUS_LABEL]}.`, 'success');
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

      {form.id && !form.hasVariants && (
        <div id="photos-section" className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          <h2 className="font-heading text-sm font-semibold text-ink">Photos</h2>
          <ImageManager listingId={form.id} />
        </div>
      )}

      {form.id && form.hasVariants && (
        <div id="photos-section" className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          <div>
            <h2 className="font-heading text-sm font-semibold text-ink">Types</h2>
            <p className="mt-0.5 font-body text-xs text-ink-soft">
              Each type has its own name, price, and photos — this is what buyers actually pick from.
            </p>
          </div>
          <VariantManager listingId={form.id} />
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

        {form.hasVariants === undefined ? (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-ink-soft/25 bg-ivory-deep/30 p-4 text-center">
            <p className="font-body text-sm font-medium text-ink">
              Do you sell just one type, or a few different types at different prices?
            </p>
            <p className="font-body text-xs text-ink-soft">e.g. Manda, Chapati, Butter Naan — each its own price.</p>
            <div className="flex justify-center gap-2 pt-1">
              <button type="button" onClick={() => update('hasVariants', false)} className={buttonStyles('secondary', 'sm')}>
                Just one type
              </button>
              <button type="button" onClick={() => update('hasVariants', true)} className={buttonStyles('accent', 'sm')}>
                A few different types
              </button>
            </div>
          </div>
        ) : form.hasVariants ? (
          <div className="rounded-xl border border-dashed border-ink-soft/25 bg-ivory-deep/30 p-4 text-center">
            <p className="font-body text-sm text-ink-soft">
              Using different types — save the basics below, then add each type&apos;s name and price
              in the Types section that appears.
            </p>
          </div>
        ) : (
          <>
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
            {form.id && (
              <div>
                <button
                  type="button"
                  onClick={convertToVariants}
                  className="font-body text-xs font-medium text-navy hover:underline"
                >
                  + Add another type
                </button>
                {convertError && <p className="mt-1 font-body text-xs text-red-700">{convertError}</p>}
              </div>
            )}
          </>
        )}

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
            {!form.hasVariants && (
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
            )}

            <Field label="Shipping" htmlFor="shippingMethod" error={errors.shippingMethod}>
              <Select
                id="shippingMethod"
                name="shippingMethod"
                value={form.shippingMethod}
                onChange={(e) => update('shippingMethod', e.target.value as ProductFormValues['shippingMethod'])}
              >
                <option value="self_managed">I&apos;ll ship it myself</option>
                {/* Delhivery isn't offered as a new choice yet — no live
                 *  courier integration exists (planning doc Decision 7).
                 *  Kept selectable only for a listing that's already using
                 *  it, so opening one to edit doesn't silently reset her
                 *  saved choice. */}
                {form.shippingMethod === 'delhivery' && (
                  <option value="delhivery" disabled>
                    Ship via Delhivery (being redesigned — can&apos;t select this for a new listing)
                  </option>
                )}
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

            {form.shippingMethod === 'self_managed' && (
              <div className="flex flex-col gap-4 rounded-xl border border-ink-soft/10 bg-ivory-deep/40 p-4">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Delivery &amp; pickup details
                </p>

                <Field
                  label="Delivery charge (₹)"
                  htmlFor="selfShipCharge"
                  error={errors.selfShipCharge}
                  hint="Shown to the buyer at checkout. Leave blank if you haven't decided yet."
                >
                  <TextInput
                    id="selfShipCharge"
                    name="selfShipCharge"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.selfShipCharge}
                    onChange={(e) => update('selfShipCharge', e.target.value)}
                    placeholder="e.g. 50"
                  />
                </Field>

                <label className="flex items-center gap-2 font-body text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.pickupEnabled}
                    onChange={(e) => update('pickupEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
                  />
                  Allow Pickup &amp; Pay for this listing
                </label>

                {form.pickupEnabled && (
                  <>
                    <Field label="Pickup from" htmlFor="pickupAddressSource" error={errors.pickupAddressSource}>
                      <Select
                        id="pickupAddressSource"
                        name="pickupAddressSource"
                        value={form.pickupAddressSource}
                        onChange={(e) =>
                          update('pickupAddressSource', e.target.value as ProductFormValues['pickupAddressSource'])
                        }
                      >
                        <option value="" disabled>
                          Choose where buyers collect from
                        </option>
                        <option value="seller">My own address</option>
                        <option value="office">A WeBohra office</option>
                      </Select>
                    </Field>

                    <Field
                      label="Minimum notice (hours)"
                      htmlFor="pickupLeadTimeHours"
                      error={errors.pickupLeadTimeHours}
                      hint="Buyers can only pick a slot at least this many hours after ordering."
                    >
                      <TextInput
                        id="pickupLeadTimeHours"
                        name="pickupLeadTimeHours"
                        type="number"
                        min="0"
                        step="1"
                        value={form.pickupLeadTimeHours}
                        onChange={(e) => update('pickupLeadTimeHours', e.target.value)}
                        placeholder="e.g. 24"
                      />
                    </Field>

                    <label className="flex items-center gap-2 font-body text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={form.showAddressOnPdp}
                        onChange={(e) => update('showAddressOnPdp', e.target.checked)}
                        className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
                      />
                      Show my pickup address on this listing&apos;s page
                    </label>
                    <p className="-mt-2 font-body text-xs text-ink-soft">
                      Off by default — your address stays private until you mark a specific order
                      ready for pickup. Turning this on shows it to everyone browsing this listing.
                    </p>
                  </>
                )}

                <Field
                  label="Weight (kg)"
                  htmlFor="weight"
                  error={errors.weight}
                  hint="Optional — used for delivery cost calculations once that's available."
                >
                  <TextInput
                    id="weight"
                    name="weight"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.weight}
                    onChange={(e) => update('weight', e.target.value)}
                    placeholder="e.g. 0.5"
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {serverError && <p className="text-sm text-red-700">{serverError}</p>}

        <SubmitButton disabled={submitting || loadingCategories || form.hasVariants === undefined}>
          {submitting
            ? 'Saving…'
            : saved
              ? 'Saved ✓'
              : form.id
                ? 'Save changes'
                : 'Continue to Add Photos'}
        </SubmitButton>
        {!form.id && (
          <p className="text-center font-body text-xs text-ink-soft">
            One form, no separate page — the moment you continue, this same screen scrolls
            straight down to Photos.
          </p>
        )}
      </form>

      {planGateMessage && (
        <PlanGateModal message={planGateMessage} onClose={() => setPlanGateMessage(null)} />
      )}
    </div>
  );
}

/** Popup shown when publishing is blocked by her subscription plan
 *  (listing limit reached, or a feature this listing uses isn't included)
 *  — separate from the form's usual inline error text since this one
 *  always has a real next step: go upgrade. Portal'd to document.body for
 *  the same reason as the WhatsApp/consultation modals elsewhere in this
 *  codebase — a fixed-position overlay needs to escape any ancestor's own
 *  transform/stacking context to actually cover the full viewport. */
function PlanGateModal({ message, onClose }: { message: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
            <TrendingUp className="h-5 w-5 text-gold" strokeWidth={2} />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">Time to upgrade?</h2>
          <p className="mt-1.5 font-body text-sm text-ink-soft">{message}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={buttonStyles('secondary', 'sm', 'flex-1')}>
            Not now
          </button>
          <a href="/seller/subscription" className={buttonStyles('accent', 'sm', 'flex-1')}>
            View plans
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const STATUS_LABEL: Record<NonNullable<ProductFormValues['status']>, string> = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
  flagged: 'Flagged',
  removed: 'Removed',
};
