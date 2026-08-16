/**
 * Object storage: the seam, not yet the implementation.
 *
 * ── The plan this follows ─────────────────────────────────────────────────
 * `_internal/ROADMAP.md` Stage 3 is specific about the shape, and this file
 * matches it rather than inventing something new: a `StorageProvider` interface
 * (upload / getTemporaryLink / delete / exists) with exactly one adapter behind
 * it, so adding a second provider later means writing one adapter and changing
 * nothing else.
 *
 * Provider order from that plan:
 *   1. filen.io — researched, not chosen. Its public links do work for a
 *      recipient with no account and do support expiry, so the original open
 *      question is answered. The blocker is different: end-to-end encryption
 *      means a server uploading on a user's behalf must hold the account master
 *      key in an environment variable, which is a far larger secret to guard
 *      than a bucket credential that can be scoped and rotated. See D-023.
 *   2. Mega.nz — same objection, same shape.
 *   3. Backblaze B2 (S3-compatible)  <-- IMPLEMENTED, see s3Adapter.ts
 *   4. serving straight from the function response  <-- the fallback
 *
 * Because B2, Cloudflare R2 and AWS S3 all speak the S3 API, one adapter covers
 * all three and switching provider is an endpoint change, not a code change.
 * That satisfies the plan's requirement that "R2 later must mean writing one
 * new adapter, nothing else" — it turns out to mean writing none.
 *
 * ── Behaviour without credentials ─────────────────────────────────────────
 * `inlineOnly` is a real provider, not a stub that throws. The API works with
 * no bucket at all: files come back inline and nothing is retained. That is a
 * documented contract, not a broken state.
 */

import { createS3Provider } from "./s3Adapter.js";
import { createFilenProvider } from "./filenAdapter.js";
import { createFileToken } from "./fileToken.js";

/** Seconds a generated file stays retrievable once storage is attached. */
export const RETENTION_SECONDS = Number(process.env.STORAGE_URL_TTL_SECONDS ?? 3600);

export interface StoredObject {
  /** Opaque key inside the bucket. */
  key: string;
  /** Time-limited download link. */
  url: string;
  expiresAt: string;
}

export interface StorageProvider {
  readonly name: string;
  /** True when this provider can actually persist. `none` answers false. */
  readonly persists: boolean;
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<StoredObject | null>;
  getTemporaryLink(key: string, ttlSeconds?: number): Promise<string | null>;
  /**
   * Fetch the bytes back. Required because files are served from our own
   * domain: api/file.ts downloads here and streams the result, so the storage
   * vendor never appears in a URL a user sees.
   */
  download?(key: string): Promise<Buffer | Uint8Array | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * The provider that runs when no bucket is configured.
 *
 * Every method succeeds and does nothing. Callers therefore need no branch of
 * their own: they upload, get null back, and report the inline contract. A
 * provider that threw would push a try/catch into every handler and would make
 * "storage is off" look like "storage is broken".
 */
const inlineOnly: StorageProvider = {
  name: "none",
  persists: false,
  async upload() {
    return null;
  },
  async getTemporaryLink() {
    return null;
  },
  async download() {
    return null;
  },
  async delete() {
    /* nothing was ever written */
  },
  async exists() {
    return false;
  },
};

let cached: StorageProvider | null = null;

/**
 * Picks the provider from the environment.
 *
 * Deliberately all-or-nothing: without STORAGE_BUCKET we return `inlineOnly`
 * rather than half-enabling on partial configuration. A half-configured bucket
 * that fails at upload time would turn a working PDF request into a 500.
 */
/**
 * Every download URL we hand out points at our own domain.
 *
 * `PUBLIC_BASE_URL` lets the domain change without a code change; without it
 * the site origin is used. The storage vendor is never part of the URL.
 */
function publicUrlFor(key: string): string {
  const base = (process.env.PUBLIC_BASE_URL?.trim() || "https://pdfly.3idhmind.in").replace(/\/$/, "");
  return `${base}/api/file/${createFileToken(key, RETENTION_SECONDS)}`;
}

/**
 * Picks the provider from the environment.
 *
 * Filen is checked first because it is the one that can actually be signed up
 * for here: B2, R2 and S3 all demand a payment card before issuing credentials,
 * so the S3 adapter — written and tested — stays available but unreachable in
 * practice. Order is preference, not quality.
 *
 * Deliberately all-or-nothing at each step: partial configuration falls through
 * to `inlineOnly` rather than half-enabling and failing at upload time, which
 * would turn a working PDF request into a 500.
 */
export function storage(): StorageProvider {
  if (cached) return cached;

  const filenEmail = process.env.FILEN_EMAIL?.trim();
  const filenPassword = process.env.FILEN_PASSWORD?.trim();
  if (filenEmail && filenPassword) {
    cached = createFilenProvider(
      {
        email: filenEmail,
        password: filenPassword,
        twoFactorCode: process.env.FILEN_2FA_CODE?.trim() || undefined,
        publicUrlFor,
      },
      RETENTION_SECONDS,
    );
    return cached;
  }

  const bucket = process.env.STORAGE_BUCKET?.trim();
  const accessKey = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secret = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.STORAGE_ENDPOINT?.trim();

  if (bucket && accessKey && secret && endpoint) {
    cached = createS3Provider(
      {
        bucket,
        accessKeyId: accessKey,
        secretAccessKey: secret,
        endpoint,
        region: process.env.STORAGE_REGION?.trim() || "auto",
      },
      RETENTION_SECONDS,
    );
    return cached;
  }

  cached = inlineOnly;
  return cached;
}

/** Test seam: forces the next storage() call to re-read the environment. */
export function resetStorageCache(): void {
  cached = null;
}

export interface StorageDisclosure {
  /** Whether this file can be retrieved again after the response. */
  persisted: boolean;
  /** Present only when the file was actually stored. */
  download_url?: string;
  /** ISO timestamp the file stops being retrievable, or null when inline. */
  expires_at: string | null;
  retention_seconds: number | null;
  /** Shown to the user verbatim. */
  message: string;
}

/**
 * What to tell the caller about the file they just received.
 *
 * This ships in every successful response so a user never has to guess whether
 * they must save the file now. The two messages say plainly which situation
 * they are in; neither hedges, because "may be available" is exactly the
 * ambiguity that costs someone their document.
 */
export function describeStorage(): StorageDisclosure {
  const provider = storage();

  if (!provider.persists) {
    return {
      persisted: false,
      expires_at: null,
      retention_seconds: null,
      message:
        "Your file is ready. Please download it now. It is delivered with this response only, " +
        "is not stored on our servers, and cannot be retrieved again once this session ends or " +
        "the page is refreshed. To keep a copy, save it before you leave.",
    };
  }

  const expires = new Date(Date.now() + RETENTION_SECONDS * 1000).toISOString();
  const hours = Math.round(RETENTION_SECONDS / 3600);
  return {
    persisted: true,
    expires_at: expires,
    retention_seconds: RETENTION_SECONDS,
    message:
      `Your file is ready and has been securely stored for the next ${hours} hour${hours === 1 ? "" : "s"}. ` +
      "You can download it again from your account until it expires, after which it is permanently deleted.",
  };
}

/**
 * Store a generated file, if storage is configured, and describe the outcome.
 *
 * The file is ALWAYS returned inline by the caller regardless — storage is a
 * backup that adds a retrievable link, never a replacement for the response
 * body. That ordering matters: a caller whose upload silently failed still has
 * their document, and the disclosure simply reverts to "download it now".
 *
 * Keys are namespaced per account and per day so a retention sweep can delete
 * by prefix, and so one user's objects are never guessable from another's.
 */
export async function persistIfPossible(
  uid: string,
  filename: string,
  bytes: Uint8Array,
  contentType = "application/pdf",
): Promise<StorageDisclosure> {
  const provider = storage();
  if (!provider.persists) return describeStorage();

  const day = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${uid}/${day}/${rand}-${filename.replace(/[^\w.-]/g, "_")}`;

  const stored = await provider.upload(key, bytes, contentType);
  if (!stored) {
    // Upload failed. Tell the truth rather than promising a link that 404s.
    return { ...describeStorage(), persisted: false, expires_at: null, retention_seconds: null,
      message:
        "Your file is ready. Please download it now. Backup storage was unavailable for this " +
        "request, so the file is delivered with this response only and cannot be retrieved again." };
  }

  return {
    persisted: true,
    expires_at: stored.expiresAt,
    retention_seconds: RETENTION_SECONDS,
    download_url: stored.url,
    message:
      `Your file is ready and has been securely stored for the next ${Math.round(RETENTION_SECONDS / 3600)} hour` +
      `${Math.round(RETENTION_SECONDS / 3600) === 1 ? "" : "s"}. You can download it again from the link above ` +
      "until it expires, after which it is permanently deleted.",
  };
}
