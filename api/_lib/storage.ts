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
 * Provider order from that plan, unchanged:
 *   1. filen.io — still an open question. Its client-side encryption may make a
 *      public, time-limited link impossible without handing over the master
 *      key. That answer decides everything downstream, and it has not been
 *      answered yet, so no adapter is written for it.
 *   2. Mega.nz
 *   3. Backblaze B2 (S3-compatible)
 *   4. serving straight from the function response  <-- what runs today
 *
 * ── What is live right now ────────────────────────────────────────────────
 * Option 4. `none` is a real provider, not a stub that throws: the API works
 * without object storage, files come back inline in the response, and nothing
 * is retained. That is a deliberate behaviour with a documented contract, not a
 * broken state waiting to be fixed.
 *
 * Wiring an adapter is: implement StorageProvider, add one line to resolve(),
 * fill the STORAGE_* variables. Handlers do not change, because they never talk
 * to a provider directly — they call describeStorage() and report what it says.
 */

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
export function storage(): StorageProvider {
  if (cached) return cached;

  const bucket = process.env.STORAGE_BUCKET?.trim();
  const accessKey = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secret = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKey || !secret) {
    cached = inlineOnly;
    return cached;
  }

  // TODO(stage-3): return the S3-compatible adapter (Backblaze B2) here once
  // the filen.io question is settled. Until an adapter exists, configured
  // credentials must not change behaviour — silently claiming persistence we
  // cannot deliver is worse than not having it.
  cached = inlineOnly;
  return cached;
}

export interface StorageDisclosure {
  /** Whether this file can be retrieved again after the response. */
  persisted: boolean;
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
