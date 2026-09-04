'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

type Toast = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-teal text-ivory', icon: CheckCircle2 },
  error: { bg: 'bg-red-600 text-ivory', icon: XCircle },
  info: { bg: 'bg-navy text-ivory', icon: AlertCircle },
};

/**
 * Sitewide toast notifications for the seller and admin portals
 * (2026-09-04, user's own ask — "validation message are not attention
 * seeking, its suggestable to have kind of toaster for seller and
 * admin"). Mounted once in each portal's own layout (see
 * app/seller/(portal)/layout.tsx and app/admin/(portal)/layout.tsx) so
 * any page/component inside either can call `useToast().showToast(...)`
 * without threading state through props.
 *
 * Errors auto-dismiss too (same 5s as success/info) — a toast is a
 * notice, not a modal a mistake should get stuck behind; the field-level
 * inline error (still shown wherever a form already has one) is what
 * actually persists until she fixes it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
            {toasts.map((toast) => {
              const { bg, icon: Icon } = VARIANT_STYLES[toast.variant];
              return (
                <div
                  key={toast.id}
                  role="status"
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 shadow-lg ${bg}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <p className="flex-1 font-body text-sm">{toast.message}</p>
                  <button
                    onClick={() => dismiss(toast.id)}
                    aria-label="Dismiss"
                    className="shrink-0 opacity-70 transition hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
