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
  listKeys: () => request<{ keys: ApiKeySummary[] }>("/api/keys"),

  createKey: (name: string) =>
    request<CreatedApiKey>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeKey: (keyId: string) =>
    request<{ revoked: boolean }>(`/api/keys?id=${encodeURIComponent(keyId)}`, {
      method: "DELETE",
    }),
};
