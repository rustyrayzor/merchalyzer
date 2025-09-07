"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, 'id'>) => string;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ToastItem = {
      id,
      duration: 2500,
      variant: 'info',
      ...toast,
    };
    setToasts((prev) => [...prev, item]);
    if (item.duration && item.duration > 0) {
      window.setTimeout(() => remove(id), item.duration);
    }
    return id;
  }, [remove]);

  const value = useMemo(() => ({ show, remove }), [show, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

function variantClasses(v?: ToastVariant): string {
  switch (v) {
    case 'success':
      return 'border-green-200 bg-green-50 text-green-900';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900';
    default:
      return 'border-gray-200 bg-white text-gray-900';
  }
}

export function Toaster({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: string) => void; }) {
  return (
    <div className="fixed top-4 right-4 z-[1000] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`w-72 shadow-md rounded-md border px-3 py-2 text-sm transition-all ${variantClasses(t.variant)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {t.title && <div className="font-medium truncate">{t.title}</div>}
              {t.description && <div className="text-xs opacity-80 break-words">{t.description}</div>}
            </div>
            <button className="text-xs opacity-60 hover:opacity-100" onClick={() => onClose(t.id)} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

