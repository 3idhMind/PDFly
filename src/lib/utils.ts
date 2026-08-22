import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MB = 1024 * 1024;

/**
 * Canonical byte formatter. Lives here — a leaf module with no heavy deps —
 * on purpose: it used to live next to the PDF engines, and importing it
 * dragged jsPDF/html2canvas into the main bundle. See _internal L-002.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}

/**
 * Adds `value` to a set, or removes it if already there, returning a new Set.
 *
 * The page-picker on Split, Rotate and Delete Pages each had its own copy of
 * this, written as a ternary evaluated for its side effects — which works, and
 * which every linter flags, and which is three places to fix if the selection
 * behaviour ever changes. Returning a new Set rather than mutating is what
 * makes it safe to call straight from a `setState` updater.
 */
export function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}
