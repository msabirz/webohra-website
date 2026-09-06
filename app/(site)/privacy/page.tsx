'use client';

import { ShieldCheck } from 'lucide-react';
import { LegalPageView } from '@/components/legal-page-view';

export default function PrivacyPage() {
  return <LegalPageView slug="privacy" icon={ShieldCheck} />;
}
