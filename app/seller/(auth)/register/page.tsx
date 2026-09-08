'use client';

import { Suspense, useEffect, useRef, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Mail, Lock, User as UserIcon, Hash, ImagePlus, ShieldCheck } from 'lucide-react';
import { setAuthToken, authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';

// Item 38 (2026-09-09) — same allow-list/size cap as every other seller
// photo uploader in this app.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type Step = 'form' | 'verify' | 'documents';
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

  // Item 38 (2026-09-09) — the ITS card photo, asked for right here as the
  // final registration step (rather than only in Settings, easy to miss)
  // since publishing now requires it. "Skip for now" stays available —
  // she can still register, sign in, and build draft listings with it
  // undone; only publishing is blocked, exactly like the GST/Udyam step.
  const [itsCardImageUrl, setItsCardImageUrl] = useState<string | null>(null);
  const [itsCardUploading, setItsCardUploading] = useState(false);
  const [itsCardError, setItsCardError] = useState<string | null>(null);
  const itsCardInputRef = useRef<HTMLInputElement>(null);

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
      setStep('documents');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleItsCardChange(file: File | undefined) {
    if (!file) return;
    setItsCardError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setItsCardError('Only JPEG, PNG, or WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setItsCardError('Photo must be under 8MB.');
      return;
    }
    setItsCardUploading(true);
    try {
      const presignRes = await authFetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, purpose: 'its_card' }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setItsCardError(presignData.error ?? 'Could not start the upload.');
        return;
      }
      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setItsCardError('Upload to storage failed. Try again.');
        return;
      }
      const saveRes = await authFetch('/api/sellers/its-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itsCardImageUrl: presignData.publicUrl }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setItsCardError(saveData.error ?? 'Could not save this photo.');
        return;
      }
      setItsCardImageUrl(saveData.itsCardImageUrl);
    } catch (err) {
      console.error('ITS card upload failed:', err);
      setItsCardError('Could not reach storage to upload this photo.');
    } finally {
      setItsCardUploading(false);
      if (itsCardInputRef.current) itsCardInputRef.current.value = '';
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
            {step === 'form' ? 'Start selling on WE Bohra' : step === 'verify' ? 'Verify your phone' : 'One last step'}
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            {step === 'form'
              ? 'Tell us about you and your business.'
              : step === 'verify'
                ? `We sent a code to ${phone}.`
                : "You're registered — add your ITS card photo now, or do it later from Settings."}
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
        ) : step === 'verify' ? (
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
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-teal/10 px-4 py-3 ring-1 ring-teal/20">
              <ShieldCheck className="h-5 w-5 shrink-0 text-teal-deep" strokeWidth={1.75} />
              <p className="font-body text-xs text-ink-soft">
                Your account is ready. A clear photo of your ITS card helps the Idara team verify you
                faster — you can also add it anytime from Settings.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {itsCardImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={itsCardImageUrl}
                  alt="ITS card"
                  className="h-20 w-28 rounded-lg object-cover ring-1 ring-ink-soft/10"
                />
              ) : (
                <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-ivory-deep">
                  <ImagePlus className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={itsCardInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleItsCardChange(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => itsCardInputRef.current?.click()}
                  disabled={itsCardUploading}
                  className={buttonStyles('secondary', 'sm', 'w-fit')}
                >
                  {itsCardUploading ? 'Uploading…' : itsCardImageUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                {itsCardError && <p className="font-body text-xs text-red-600">{itsCardError}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(redirectTo)}
              disabled={itsCardUploading}
              className={buttonStyles('primary', 'md')}
            >
              {itsCardImageUrl ? 'Continue to my portal' : 'Skip for now — continue to my portal'}
            </button>
          </div>
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
