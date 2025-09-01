import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a UUID v4 string compatible with all browsers
 * Falls back to a custom implementation if crypto.randomUUID is not available
 */
export function generateUUID(): string {
  // Use native crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Currency helpers (Printify prices are in cents)
export function centsToDollars(cents: number): number {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return 0;
  return Math.round(cents) / 100;
}

export function formatCentsUSD(cents: number): string {
  return centsToDollars(cents).toFixed(2);
}

export function dollarsToCents(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.\-]/g, '')) : value;
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}
