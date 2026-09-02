'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch } from '@/lib/session-client';
import { ProductForm, type ProductFormValues } from '@/components/seller/product-form';
import { Skeleton } from '@/components/skeleton';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ProductFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    authFetch(`/api/listings/${params.id}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/seller/login');
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        const l = data.listing;
        const fieldValues: Record<string, unknown> = {};
        for (const f of l.fields ?? []) fieldValues[f.fieldKey] = f.value;
        setInitial({
          id: l.id,
          slug: l.slug,
          subcategoryId: String(l.subcategoryId),
          title: l.title,
          description: l.description,
          // null means she's already using different types (see
          // listings.price's own comment in db/schema.ts) — mapped to '' here
          // since ProductFormValues.price is always a string, and hasVariants
          // carries the actual signal for which mode this listing is in.
          price: l.price ?? '',
          hasVariants: l.price === null,
          shippingMethod: l.shippingMethod,
          shippingEstimateText: l.shippingEstimateText ?? '',
          stockQuantity: l.stockQuantity != null ? String(l.stockQuantity) : '',
          status: l.status,
          fieldValues,
        });
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-heading text-lg font-semibold text-ink">Product not found</p>
        <p className="font-body text-sm text-ink-soft">
          It may have been removed, or it doesn&apos;t belong to your account.
        </p>
      </div>
    );
  }

  if (!initial) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-56" />
        {/* Status bar */}
        <Skeleton className="h-14 w-full rounded-2xl" />
        {/* Photos card */}
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="aspect-square rounded-xl" />
            <Skeleton className="aspect-square rounded-xl" />
            <Skeleton className="aspect-square rounded-xl" />
            <Skeleton className="aspect-square rounded-xl" />
          </div>
        </div>
        {/* Form fields card */}
        <div className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Edit product</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">{initial.title}</p>
      </div>
      <ProductForm initial={initial} />
    </div>
  );
}
