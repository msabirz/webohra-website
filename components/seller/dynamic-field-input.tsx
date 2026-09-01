'use client';

import { useRef, useState } from 'react';
import { Loader2, ImagePlus } from 'lucide-react';
import { Field, TextInput, TextArea, Select } from '@/components/form';
import { authFetch } from '@/lib/session-client';

export type SubcategoryFieldDef = {
  id: number;
  label: string;
  fieldKey: string;
  fieldType: 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'textarea' | 'image';
  required: boolean;
  options: string[] | null;
};

/**
 * Renders the right control for one FR-17 admin-configured field — the
 * seller-facing half of the same system the Admin Panel's field-builder
 * writes to. `value`/`onChange` work against a plain `unknown`, shaped per
 * fieldType exactly as lib/listing-fields.ts's checkFieldValue expects it
 * server-side, so what gets submitted here is already in the right shape.
 */
export function DynamicFieldInput({
  field,
  value,
  onChange,
  error,
  listingId,
}: {
  field: SubcategoryFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  listingId?: number;
}) {
  const htmlId = `field-${field.fieldKey}`;
  const label = field.required ? field.label : `${field.label} (optional)`;

  switch (field.fieldType) {
    case 'text':
      return (
        <Field label={label} htmlFor={htmlId} error={error}>
          <TextInput
            id={htmlId}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </Field>
      );
    case 'number':
      return (
        <Field label={label} htmlFor={htmlId} error={error}>
          <TextInput
            id={htmlId}
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            required={field.required}
          />
        </Field>
      );
    case 'textarea':
      return (
        <Field label={label} htmlFor={htmlId} error={error}>
          <TextArea
            id={htmlId}
            rows={3}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </Field>
      );
    case 'select':
      return (
        <Field label={label} htmlFor={htmlId} error={error}>
          <Select
            id={htmlId}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          >
            <option value="" disabled>
              Select…
            </option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'boolean':
      return (
        <Field label={label} htmlFor={htmlId} error={error}>
          <label className="flex items-center gap-2 font-body text-sm text-ink">
            <input
              id={htmlId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
            />
            Yes
          </label>
        </Field>
      );
    case 'multi_select': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      function toggle(opt: string) {
        onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
      }
      return (
        <Field label={label} htmlFor={htmlId} error={error}>
          <div id={htmlId} className="flex flex-wrap gap-2">
            {(field.options ?? []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`rounded-full border px-3 py-1.5 font-body text-xs font-medium transition ${
                  selected.includes(opt)
                    ? 'border-navy bg-navy text-ivory'
                    : 'border-ink-soft/25 text-ink-soft hover:border-navy/40'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>
      );
    }
    case 'image':
      return (
        <ImageFieldInput field={field} value={(value as string | null) ?? null} onChange={onChange} error={error} listingId={listingId} />
      );
    default:
      return null;
  }
}

function ImageFieldInput({
  field,
  value,
  onChange,
  error,
  listingId,
}: {
  field: SubcategoryFieldDef;
  value: string | null;
  onChange: (value: unknown) => void;
  error?: string;
  listingId?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const htmlId = `field-${field.fieldKey}`;
  const label = field.required ? field.label : `${field.label} (optional)`;

  async function handleFile(file: File | undefined) {
    if (!file || !listingId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const presignRes = await authFetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, listingId }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setUploadError(presignData.error ?? 'Could not start the upload.');
        return;
      }
      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setUploadError('Upload to storage failed. Try again.');
        return;
      }
      onChange(presignData.publicUrl);
    } catch (err) {
      console.error('Field image upload failed:', err);
      setUploadError('Could not reach storage to upload this photo — check the browser console/Network tab for details.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!listingId) {
    return (
      <Field label={label} htmlFor={htmlId} error={error}>
        <p className="rounded-md border border-dashed border-ink-soft/25 px-3 py-2.5 font-body text-xs text-ink-soft">
          Save the basics first — this photo can be added once the draft exists.
        </p>
      </Field>
    );
  }

  return (
    <Field label={label} htmlFor={htmlId} error={error ?? uploadError ?? undefined}>
      {value ? (
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-lg bg-ivory-deep ring-1 ring-ink-soft/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
            <img src={value} alt="" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="font-body text-xs font-medium text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md border-2 border-dashed border-ink-soft/25 px-3 py-2.5 font-body text-xs text-ink-soft transition hover:border-navy/40 hover:text-navy disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          )}
          {uploading ? 'Uploading…' : 'Add photo'}
        </button>
      )}
      <input
        id={htmlId}
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />
    </Field>
  );
}
