/**
 * Thin client for PDFly's own API.
 *
 * Attaches the caller's Firebase ID token. Deliberately minimal — every request
 * that needs auth goes through here so there is exactly one place that knows
 * how a token gets onto a request.
 */

import { getIdToken } from "@/lib/firebase/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? "UNKNOWN",
      body?.message ?? `Request failed (${res.status})`,
    );
  }
  return body as T;
}

/* ------------------------------------------------------------------- keys */

export interface ApiKeySummary {
  keyId: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  scopes: string[];
  rateLimitPerMin: number;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export interface CreatedApiKey {
  /** The raw key. Returned exactly once — show it, then let it go. */
  key: string;
  keyId: string;
  keyPrefix: string;
  name: string;
  warning: string;
}

export const api = {
  /** Identity + admin flag, decided server-side. See api/me.ts. */
  me: () => request<{ uid: string; authType: string; isAdmin: boolean }>("/api/account/me"),

  listKeys: () => request<{ keys: ApiKeySummary[] }>("/api/account/keys"),

  createKey: (name: string) =>
    request<CreatedApiKey>("/api/account/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeKey: (keyId: string) =>
    request<{ revoked: boolean }>(`/api/account/keys?id=${encodeURIComponent(keyId)}`, {
      method: "DELETE",
    }),
};

/* ------------------------------------------------------------------ admin */

export interface FeedbackEntry {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  rating: number | null;
  path: string | null;
  createdAt: string | null;
}

export interface AdminPost {
  slug: string;
  title: string;
  category?: string;
  publishAt?: string;
  status?: string;
}

/** Every one of these 403s for a non-admin caller, server-side. */
export const admin = {
  feedback: () => request<{ feedback: FeedbackEntry[]; count: number }>("/api/admin/feedback"),

  deleteFeedback: (id: string) =>
    request<{ deleted: string }>(`/api/admin/feedback?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // `all=1` includes drafts and future-dated posts, which the public read hides.
  posts: () => request<{ posts: AdminPost[]; count: number }>("/api/blog?all=1"),

  deletePost: (slug: string) =>
    request<{ deleted: string }>(`/api/blog?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }),
};
