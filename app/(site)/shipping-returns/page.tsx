import { Truck } from 'lucide-react';
import { StaticPage } from '@/components/static-page';

export default function ShippingReturnsPage() {
  return (
    <StaticPage title="Shipping & Returns" icon={Truck}>
      <p>
        Sellers ship in one of two ways: self-managed (she updates status herself, no live
        tracking) or via Delhivery (real, automatic tracking).
      </p>
      <p>Returns and refunds are arranged directly with the seller — WE Bohra doesn&apos;t process payments today, so there&apos;s nothing to refund on our side yet.</p>
      <p className="italic">This page is a placeholder — a full policy is coming soon.</p>
    </StaticPage>
  );
}
