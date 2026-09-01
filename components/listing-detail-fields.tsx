import { Check, X } from 'lucide-react';

export type ListingFieldValue = {
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'textarea' | 'image';
  value: unknown;
};

/**
 * Shared "Details" card for FR-17's per-subcategory fields — used by both
 * the product PDP and the service SDP, so a buyer sees the same treatment
 * regardless of which kind of listing she's looking at. Only ever shows
 * fields that actually have a value; a listing with none renders nothing
 * (the caller should skip the section entirely in that case).
 */
export function ListingDetailFields({ fields }: { fields: ListingFieldValue[] }) {
  if (fields.length === 0) return null;

  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.fieldKey} className="flex flex-col gap-1">
          <dt className="font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">{field.label}</dt>
          <dd className="font-body text-sm text-ink">{renderValue(field)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(field: ListingFieldValue) {
  switch (field.fieldType) {
    case 'boolean':
      return field.value ? (
        <span className="inline-flex items-center gap-1 text-teal-deep">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-ink-soft">
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          No
        </span>
      );
    case 'multi_select':
      return Array.isArray(field.value) ? (
        <span className="flex flex-wrap gap-1.5">
          {(field.value as string[]).map((v) => (
            <span key={v} className="rounded-full bg-ivory-deep px-2.5 py-0.5 text-xs">
              {v}
            </span>
          ))}
        </span>
      ) : null;
    case 'textarea':
      return <span className="whitespace-pre-wrap leading-relaxed">{String(field.value)}</span>;
    case 'image':
      return typeof field.value === 'string' && field.value ? (
        <div className="h-20 w-20 overflow-hidden rounded-xl bg-ivory-deep ring-1 ring-ink-soft/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
          <img src={field.value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null;
    default:
      return String(field.value);
  }
}
