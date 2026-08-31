'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/cart-context';
import { buttonStyles } from '@/lib/button-styles';

type ListingSnapshot = {
  id: number;
  title: string;
  price: string;
  sellerId: number;
  businessName: string | null;
  shippingMethod: 'self_managed' | 'delhivery';
};

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, count } = useCart();
  const [listings, setListings] = useState<Record<number, ListingSnapshot>>({});

  const ids = useMemo(() => items.map((i) => i.listingId), [items]);

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        fetch(`/api/listings/${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => data?.listing as ListingSnapshot | undefined),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<number, ListingSnapshot> = {};
      for (const listing of results) {
        if (listing) map[listing.id] = listing;
      }
      setListings(map);
    });
    return () => {
      cancelled = true;
    };
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = items.reduce((sum, item) => {
    const listing = listings[item.listingId];
    return listing ? sum + Number(listing.price) * item.quantity : sum;
  }, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-ink/40 backdrop-blur-sm">
      <button aria-label="Close cart" onClick={closeCart} className="absolute inset-0" />
      <div className="relative flex h-full w-full max-w-md flex-col bg-ivory shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-soft/10 px-6 py-5">
          <h2 className="font-heading text-lg font-semibold text-ink">Your cart ({count})</h2>
          <button
            onClick={closeCart}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-white hover:text-ink"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                <ShoppingBag className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
              </span>
              <p className="font-body text-sm text-ink-soft">Your cart is empty.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => {
                const listing = listings[item.listingId];
                return (
                  <li
                    key={item.listingId}
                    className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-body text-sm font-semibold text-ink">
                          {listing?.title ?? `Collection #${item.listingId}`}
                        </p>
                        {listing?.businessName && (
                          <p className="font-body text-xs text-ink-soft">{listing.businessName}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.listingId)}
                        aria-label="Remove item"
                        className="rounded-full p-1.5 text-ink-soft/50 transition hover:bg-ivory-deep hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 rounded-full border border-ink-soft/15 p-1">
                        <button
                          onClick={() => updateQuantity(item.listingId, item.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" strokeWidth={2} />
                        </button>
                        <span className="w-5 text-center font-body text-xs font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.listingId, item.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                      {listing && (
                        <p className="font-body text-sm font-semibold text-navy">
                          ₹{(Number(listing.price) * item.quantity).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-ink-soft/10 bg-white px-6 py-5">
            <div className="flex items-center justify-between font-body text-sm">
              <span className="text-ink-soft">Subtotal</span>
              <span className="font-semibold text-ink">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <Link href="/checkout" onClick={closeCart} className={buttonStyles('primary', 'lg')}>
              Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
