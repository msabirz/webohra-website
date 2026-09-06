import { Truck } from 'lucide-react';
import { StaticPage } from '@/components/static-page';

export default function ShippingReturnsPage() {
  return (
    <StaticPage title="Shipping & Returns" icon={Truck}>
      <p>
        Most sellers ship self-managed today — she arranges her own courier and updates the
        order status herself. WE Bohra&apos;s own managed Delhivery courier account is being
        rolled out to eligible plans.
      </p>
      <p>
        If you paid online, a refund is processed by WE Bohra back to your original payment
        method. If you paid Cash on Delivery, any return is arranged directly with the seller.
      </p>
      <p className="italic">This page is a placeholder — a full policy is coming soon.</p>
    </StaticPage>
  );
}
