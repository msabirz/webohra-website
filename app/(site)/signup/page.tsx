'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User as UserIcon } from 'lucide-react';
import { setAuthToken } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { PhoneInput } from '@/components/phone-input';

type Step = 'form' | 'verify';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
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
      const res = await fetch('/api/auth/signup/verify', {
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
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-14">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <UserPlus className="h-6 w-6 text-gold" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {step === 'form' ? 'Create your account' : 'Verify your phone'}
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft">
            {step === 'form'
              ? 'Just a few details to get started.'
              : `We sent a code to ${phone}.`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        {step === 'form' ? (
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <UserIcon
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                  strokeWidth={2}
                />
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
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                  strokeWidth={2}
                />
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
              <PhoneInput id="signup-phone" value={phone} onChange={setPhone} required />
              {fieldErrors.phone && <p className="font-body text-xs text-red-700">{fieldErrors.phone}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                  strokeWidth={2}
                />
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
              {fieldErrors.password && (
                <p className="font-body text-xs text-red-700">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
                  strokeWidth={2}
                />
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

            {error && <p className="font-body text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Creating account…' : 'Create account'}
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
          Already have an account?{' '}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-navy hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
