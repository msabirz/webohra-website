import { FileText } from 'lucide-react';
import { StaticPage } from '@/components/static-page';

export default function TermsPage() {
  return (
    <StaticPage title="Terms of Service" icon={FileText}>
      <p>
        By using WE Bohra you agree to use the platform honestly and respectfully, whether
        you&apos;re browsing, buying, or selling.
      </p>
      <p className="italic">This page is a placeholder — full terms are coming soon.</p>
    </StaticPage>
  );
}
