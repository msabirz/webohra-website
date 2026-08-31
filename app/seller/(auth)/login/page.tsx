'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Mail, Lock, ArrowRight } from 'lucide-react';
import { setAuthToken, authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';

type Step = 'login' | 'forgot-request' | 'forgot-reset';

export default function SellerLoginPage() {
  return (
    <Suspense fallback={null}>
      <SellerLoginForm />
    </Suspense>
  );
}

function SellerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/seller/dashboard';

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // After sign-in, a seller portal is only reachable for accounts that
  // actually have a seller profile — anyone else gets routed to /seller/become
  // instead of a portal she hasn't set up yet.
  async function routeAfterLogin(token: string) {
    setAuthToken(token);
    const meRes = await authFetch('/api/auth/me');
    const me = await meRes.json().catch(() => null);
    if (me?.sellerProfile) {
      router.push(redirectTo);
    } else {
      router.push(`/seller/become?redirect=${encodeURIComponent(redirectTo)}`);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Incorrect email or password');
        return;
      }
      await routeAfterLogin(data.token);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/forgot-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send a code. Try again.');
        return;
      }
      setDevCode(data.devCode ?? null);
      setPhoneHint(data.phoneHint ?? null);
      setStep('forgot-reset');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not reset your password. Try again.');
        return;
      }
      await routeAfterLogin(data.token);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const TITLES: Record<Step, { title: string; subtitle: string }> = {
    login: { title: 'Seller sign in', subtitle: 'Enter your email and password.' },
    'forgot-request': { title: 'Reset your password', subtitle: 'Enter the email on your account.' },
    'forgot-reset': {
      title: 'Check your phone',
      subtitle: phoneHint
        ? `We sent a code to the number ending in ${phoneHint}.`
        : 'Enter the code and a new password.',
    },
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-14">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy/5">
          <Store className="h-6 w-6 text-navy" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">{TITLES[step].title}</h1>
          <p className="mt-1 font-body text-sm text-ink-soft">{TITLES[step].subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        {step === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                autoFocus
                className={`${inputStyles} w-full pl-10`}
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className={`${inputStyles} w-full pl-10`}
              />
            </div>
            {error && <p className="font-body text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('forgot-request');
                setError(null);
              }}
              className="font-body text-xs text-ink-soft transition hover:text-ink hover:underline"
            >
              Forgot password?
            </button>
          </form>
        )}

        {step === 'forgot-request' && (
          <form onSubmit={handleForgotRequest} className="flex flex-col gap-4" noValidate>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={2} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                autoFocus
                className={`${inputStyles} w-full pl-10`}
              />
            </div>
            {error && <p className="font-body text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Sending…' : 'Send reset code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('login');
                setError(null);
              }}
              className="font-body text-sm text-ink-soft transition hover:text-ink hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}

        {step === 'forgot-reset' && (
          <form onSubmit={handleForgotReset} className="flex flex-col gap-4" noValidate>
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
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min. 8 characters)"
              required
              minLength={8}
              className={inputStyles}
            />
            {error && <p className="font-body text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className={buttonStyles('primary', 'md')}>
              {submitting ? 'Resetting…' : 'Reset password & sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('login');
                setError(null);
              }}
              className="font-body text-sm text-ink-soft transition hover:text-ink hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>

      {step === 'login' && (
        <Link
          href={`/seller/register?redirect=${encodeURIComponent(redirectTo)}`}
          className="flex items-center justify-between rounded-2xl border-2 border-dashed border-navy/25 bg-navy/5 px-5 py-4 transition hover:border-navy/40 hover:bg-navy/10"
        >
          <div>
            <p className="font-heading text-sm font-semibold text-ink">New to selling on WE Bohra?</p>
            <p className="font-body text-xs text-ink-soft">Create your seller account.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-navy" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
