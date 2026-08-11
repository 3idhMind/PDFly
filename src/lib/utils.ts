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
