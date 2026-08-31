import { Sparkles } from 'lucide-react';
import { StaticPage } from '@/components/static-page';

export default function AboutPage() {
  return (
    <StaticPage title="About WE Bohra" icon={Sparkles}>
      <p>
        WE Bohra is a marketplace connecting Bohra women-owned businesses with buyers across
        India — Food, Textile, Beauty &amp; Occasion, IT &amp; Services, and more.
      </p>
      <p>
        Every seller is verified against her ITS ID before her products go live, and every
        collection built here is meant to make it a little easier for her business to reach
        customers directly.
      </p>
      <p className="italic">This page is a placeholder — full content coming soon.</p>
    </StaticPage>
  );
}
