import { Mail } from 'lucide-react';
import { StaticPage } from '@/components/static-page';

export default function ContactPage() {
  return (
    <StaticPage title="Contact us" icon={Mail}>
      <p>Have a question about an order, a collection, or becoming a seller?</p>
      <p className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-ink-soft" strokeWidth={2} />
        <span className="text-ink">support@webohra.example</span>
      </p>
      <p className="italic">This page is a placeholder — a real support form is coming soon.</p>
    </StaticPage>
  );
}
