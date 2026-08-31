'use client';

import { inputStyles } from '@/lib/button-styles';

/**
 * Every phone field on the site uses this — a fixed 🇮🇳 +91 prefix beside a
 * plain 10-digit input, rather than relying on a regex to catch a
 * free-typed country code. `value`/`onChange` only ever carry the bare
 * 10-digit number (see phoneField() in lib/validation.ts).
 */
export function PhoneInput({
  id,
  value,
  onChange,
  required,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span
        className={`${inputStyles} flex shrink-0 items-center gap-1.5 bg-ivory-deep text-ink-soft`}
      >
        🇮🇳 +91
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="9876543210"
        maxLength={10}
        required={required}
        autoFocus={autoFocus}
        className={`${inputStyles} flex-1`}
      />
    </div>
  );
}
