import { ProductForm } from '@/components/seller/product-form';

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Add a product</h1>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Fill in the basics and save — photos and a live preview appear right here, on this same
          page.
        </p>
      </div>
      <ProductForm />
    </div>
  );
}
