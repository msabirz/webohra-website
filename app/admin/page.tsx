'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/session-client';

/** /admin bare root just routes to wherever makes sense — the (auth) and
 *  (portal) route groups handle everything else. */
export default function AdminRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getAuthToken() ? '/admin/dashboard' : '/admin/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory">
      <p className="font-body text-sm text-ink-soft">Loading…</p>
    </div>
  );
}
