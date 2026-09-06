'use client';

import { FileText } from 'lucide-react';
import { LegalPageView } from '@/components/legal-page-view';

export default function TermsPage() {
  return <LegalPageView slug="terms" icon={FileText} />;
}
