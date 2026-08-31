'use client';

import { useState, FormEvent } from 'react';
import { User as UserIcon, KeyRound } from 'lucide-react';
import { authFetch } from '@/lib/session-client';
import { buttonStyles, inputStyles } from '@/lib/button-styles';
import { useAdminPortal } from '@/lib/admin-context';

export default function AdminSettingsPage() {
  const { me } = useAdminPortal();

  const [name, setName] = useState(me.name ?? '');
  const [email, setEmail] = useState(me.email ?? '');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    setAccountSaving(true);
    setAccountError(null);
    setAccountSaved(false);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAccountError(data.error ?? 'Could not save.');
        return;
      }
      window.dispatchEvent(new Event('wb:auth-changed'));
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 2000);
    } finally {
      setAccountSaving(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      const res = await authFetch('/api/auth/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.issues?.password?.[0] ?? data.error ?? 'Could not save.');
        return;
      }
      setNewPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">Your own account details.</p>
      </div>

      <form onSubmit={saveAccount} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <UserIcon className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Account
        </h2>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyles} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-ink">Phone number</label>
          <input value={me.phone} disabled className={`${inputStyles} bg-ivory-deep text-ink-soft`} />
        </div>
        {accountError && <p className="font-body text-sm text-red-700">{accountError}</p>}
        <button type="submit" disabled={accountSaving} className={buttonStyles('secondary', 'md')}>
          {accountSaving ? 'Saving…' : accountSaved ? 'Saved ✓' : 'Save account details'}
        </button>
      </form>

      <form onSubmit={changePassword} className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-ink-soft" strokeWidth={2} />
          Password
        </h2>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          minLength={8}
          className={inputStyles}
        />
        {passwordError && <p className="font-body text-sm text-red-700">{passwordError}</p>}
        <button
          type="submit"
          disabled={passwordSaving || newPassword.length === 0}
          className={buttonStyles('secondary', 'md')}
        >
          {passwordSaving ? 'Saving…' : passwordSaved ? 'Saved ✓' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
