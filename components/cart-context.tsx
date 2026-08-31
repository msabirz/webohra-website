'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  listingId: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (listingId: number, quantity: number) => void;
  updateQuantity: (listingId: number, quantity: number) => void;
  removeItem: (listingId: number) => void;
  clear: () => void;
  count: number;
};

const CART_KEY = 'wb_cart';

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * "UI-only cart" per the requester's chosen scope: fully functional add/edit/
 * remove and checkout, persisted client-side — the SRS's actual Phase 2
 * payment gateway (Razorpay) and multi-seller order-splitting model aren't
 * built. Checkout still creates a real order server-side (see /api/orders)
 * so this isn't a pure mockup, just not a money-moving one.
 *
 * Cart items are always delivery — Pickup & Pay is a separate, direct PDP
 * flow (see PickupRequestModal), not a cart fulfillment option, per the
 * requester's explicit split between the two.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((listingId: number, quantity: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === listingId);
      if (existing) {
        return prev.map((i) =>
          i.listingId === listingId ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { listingId, quantity }];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((listingId: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.listingId !== listingId)
        : prev.map((i) => (i.listingId === listingId ? { ...i, quantity } : i)),
    );
  }, []);

  const removeItem = useCallback((listingId: number) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({
      items,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      updateQuantity,
      removeItem,
      clear,
      count,
    }),
    [items, isOpen, addItem, updateQuantity, removeItem, clear, count],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
