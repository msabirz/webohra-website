'use client';

import { Suspense, useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Mail, Lock, User as UserIcon, Hash } from 'lucide-react';
import { setAuthToken } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';

type Step = 'form' | 'verify';
type Jamaat = { id: number; city: string; name: string };

export default function SellerRegisterPage() {
  return (
    <Suspense fallback={null}>
      <SellerRegisterForm />
    </Suspense>
  );
}

function SellerRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/seller/dashboard';

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [itsId, setItsId] = useState('');
  const [plansDelhivery, setPlansDelhivery] = useState(false);
  const [jamaatId, setJamaatId] = useState('');
  const [jamaats, setJamaats] = useState<Jamaat[]>([]);

  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (plansDelhivery && jamaats.length === 0) {
      fetch('/api/jamaats')
        .then((res) => res.json())
        .then((data) => setJamaats(data.jamaats ?? []))
        .catch(() => setError('Could not load the jamaat list. Try again.'));
    }
  }, [plansDelhivery, jamaats.length]);

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/sellers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          businessName,
          itsId,
          plansDelhiveryShipping: plansDelhivery,
          jamaatId: plansDelhivery && jamaatId ? Number(jamaatId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code) setErrorCode(data.code);
        if (data.issues) {
          const errs: Record<string, string> = {};
          for (const key of Object.keys(data.issues)) errs[key] = data.issues[key]?.[0];
          setFieldErrors(errs);
        }
        if (!data.issues || data.code) setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDevCode(data.devCode ?? null);
      setStep('verify');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/sellers/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Incorrect code');
        return;
      }
      setAuthToken(data.token);
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
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {step === 'form' ? 'Start selling on WE Bohra' : 'Verify your phone'}
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            {step === 'form'
              ? 'Tell us about you and your business.'
              : `We sent a code to ${phone}.`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        {step === 'form' ? (
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-4" noValidate>
            <p className="font-heading text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Your account
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  required
                  autoFocus
                  className={`${inputStyles} w-full pl-10`}
                />
              </div>
              {fieldErrors.name && <p className="font-body text-xs text-red-700">{fieldErrors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className={`${inputStyles} w-full pl-10`}
                />
              </div>
              {fieldErrors.email && <p className="font-body text-xs text-red-700">{fieldErrors.email}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <PhoneInput id="seller-phone" value={phone} onChange={setPhone} required />
              {fieldErrors.phone && <p className="font-body text-xs text-red-700">{fieldErrors.phone}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min. 8 characters)"
                  required
                  minLength={8}
                  className={`${inputStyles} w-full pl-10`}
                />
              </div>
              {fieldErrors.password && <p className="font-body text-xs text-red-700">{fieldErrors.password}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  className={`${inputStyles} w-full pl-10`}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="font-body text-xs text-red-700">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <p className="mt-2 font-heading text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Your business
            </p>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business name"
                  required
                  className={`${inputStyles} w-full pl-10`}
                />
              </div>
              {fieldErrors.businessName && (
                <p className="font-body text-xs text-red-700">{fieldErrors.businessName}</p>
              )}
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
              <p className="font-body text-xs text-ink-soft">
                Admin verifies this before your products can go live.
              </p>
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
                <select
                  value={jamaatId}
                  onChange={(e) => setJamaatId(e.target.value)}
                  required
                  className={inputStyles}
                >
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

            {error && (
              <div className="font-body text-sm text-red-700">
                {error}
                {errorCode === 'already_has_account' && (
                  <>
                    {' '}
                    <Link href={`/seller/login?redirect=${encodeURIComponent(redirectTo)}`} className="font-semibold underline">
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            )}
            <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Creating account…' : 'Create seller account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4" noValidate>
            {devCode && (
              <div className="rounded-xl border border-gold/30 bg-gold-soft/20 px-4 py-3 font-body text-sm text-ink">
                Dev mode — no SMS was sent. Your code is <strong>{devCode}</strong>.
              </div>
            )}
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              required
              autoFocus
              className={inputStyles}
            />
            {error && <p className="font-body text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Verifying…' : 'Verify & finish'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
              }}
              className="font-body text-sm text-ink-soft transition hover:text-ink hover:underline"
            >
              Back
            </button>
          </form>
        )}
      </div>

      {step === 'form' && (
        <p className="text-center font-body text-xs text-ink-soft">
          Already selling with us?{' '}
          <Link
            href={`/seller/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-navy hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
