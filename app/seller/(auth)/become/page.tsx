'use client';

import { Suspense, useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store, Hash } from 'lucide-react';
import { authFetch, getAuthToken } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';

type Jamaat = { id: number; city: string; name: string };

export default function BecomeSellerPage() {
  return (
    <Suspense fallback={null}>
      <BecomeSellerForm />
    </Suspense>
  );
}

function BecomeSellerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/seller/dashboard';

  const [businessName, setBusinessName] = useState('');
  const [itsId, setItsId] = useState('');
  const [plansDelhivery, setPlansDelhivery] = useState(false);
  const [jamaatId, setJamaatId] = useState('');
  const [jamaats, setJamaats] = useState<Jamaat[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) {
      router.push(`/seller/login?redirect=${encodeURIComponent(`/seller/become?redirect=${redirectTo}`)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (plansDelhivery && jamaats.length === 0) {
      fetch('/api/jamaats')
        .then((res) => res.json())
        .then((data) => setJamaats(data.jamaats ?? []))
        .catch(() => setError('Could not load the jamaat list. Try again.'));
    }
  }, [plansDelhivery, jamaats.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await authFetch('/api/sellers/register/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          itsId,
          plansDelhiveryShipping: plansDelhivery,
          jamaatId: plansDelhivery && jamaatId ? Number(jamaatId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          const errs: Record<string, string> = {};
          for (const key of Object.keys(data.issues)) errs[key] = data.issues[key]?.[0];
          setFieldErrors(errs);
        } else {
          setError(data.error ?? 'Something went wrong. Please try again.');
        }
        return;
      }
      router.push(redirectTo);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-14">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <Store className="h-6 w-6 text-gold" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Add your seller details</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            You&apos;re signed in already — just tell us about your business.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              required
              autoFocus
              className={`${inputStyles} w-full pl-10`}
            />
          </div>
          {fieldErrors.businessName && <p className="font-body text-xs text-red-700">{fieldErrors.businessName}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
            <input
              inputMode="numeric"
              value={itsId}
              onChange={(e) => setItsId(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="ITS ID (8 digits)"
              required
              maxLength={8}
              className={`${inputStyles} w-full pl-10`}
            />
          </div>
          <p className="font-body text-xs text-ink-soft">Admin verifies this before your products can go live.</p>
          {fieldErrors.itsId && <p className="font-body text-xs text-red-700">{fieldErrors.itsId}</p>}
        </div>

        <label className="flex items-center gap-2 font-body text-sm text-ink">
          <input
            type="checkbox"
            checked={plansDelhivery}
            onChange={(e) => setPlansDelhivery(e.target.checked)}
            className="h-4 w-4 rounded border-ink-soft/30 text-navy focus:ring-navy/30"
          />
          I plan to ship via Delhivery for at least one product
        </label>

        {plansDelhivery && (
          <div className="flex flex-col gap-1.5">
            <select value={jamaatId} onChange={(e) => setJamaatId(e.target.value)} required className={inputStyles}>
              <option value="" disabled>
                Select your nearest jamaat
              </option>
              {jamaats.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} — {j.city}
                </option>
              ))}
            </select>
            {fieldErrors.jamaatId && <p className="font-body text-xs text-red-700">{fieldErrors.jamaatId}</p>}
          </div>
        )}

        {error && <p className="font-body text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
          {submitting ? 'Saving…' : 'Start selling'}
        </button>
      </form>
    </div>
  );
}
