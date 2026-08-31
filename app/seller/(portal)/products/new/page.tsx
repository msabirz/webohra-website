import { ProductForm } from '@/components/seller/product-form';

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Add a product</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Saved as a draft — you&apos;ll add photos and publish from the next screen.
        </p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
