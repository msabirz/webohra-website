'use client';

import { useEffect, useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import { StaticPage } from '@/components/static-page';
import { inputStyles, buttonStyles } from '@/lib/button-styles';

type Category = { id: number; name: string };

/**
 * A real support form (2026-09-06, marketplace-completeness scan) —
 * this used to be a bare display email with "a real support form is
 * coming soon." No account required, same as before.
 */
export default function ContactPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch('/api/support-ticket-categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(categoryId && { categoryId }),
          name,
          email,
          phone,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstIssue = data.issues && Object.values(data.issues)[0];
        setError((Array.isArray(firstIssue) ? firstIssue[0] : undefined) ?? data.error ?? 'Could not send this.');
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <StaticPage title="Contact us" icon={CheckCircle2}>
        <p>Thanks — we&apos;ve got your message and will get back to you soon.</p>
      </StaticPage>
    );
  }

  return (
    <StaticPage title="Contact us" icon={Mail}>
      <p>Have a question about an order, a collection, or becoming a seller? Send us a message.</p>
      <div className="flex flex-col gap-3">
        {categories.length > 0 && (
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputStyles}>
            <option value="">What&apos;s this about? (optional)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputStyles}
        />
        <input placeholder="Phone (optional if you gave an email)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputStyles} />
        <textarea
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className={inputStyles}
        />
        {error && <p className="font-body text-xs text-red-700">{error}</p>}
        <button onClick={submit} disabled={submitting} className={buttonStyles('primary', 'md', 'w-fit')}>
          {submitting ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </StaticPage>
  );
}
