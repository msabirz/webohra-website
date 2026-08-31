import { ShieldCheck } from 'lucide-react';
import { StaticPage } from '@/components/static-page';

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" icon={ShieldCheck}>
      <p>
        Contacting a seller through &quot;Buy on WhatsApp&quot; opens a direct WhatsApp
        conversation using her registered number — WE Bohra doesn&apos;t relay or mask this in
        the current build.
      </p>
      <p>
        We collect only what&apos;s needed to place an order or verify a seller&apos;s identity.
      </p>
      <p className="italic">This page is a placeholder — a full policy is coming soon.</p>
    </StaticPage>
  );
}
