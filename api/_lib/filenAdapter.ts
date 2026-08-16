import type { StorageProvider, StoredObject } from "./storage.js";

/**
 * Filen.io storage adapter.
 *
 * ── Why Filen and not an S3 bucket ────────────────────────────────────────
 * Backblaze B2, Cloudflare R2 and AWS S3 all require a payment card before
 * they will issue credentials, even on their free tiers. That is a hard
 * blocker here, so the S3 adapter — which is written, tested and works — is
 * not usable. Filen's free tier needs an email address and nothing else.
 *
 * ── Why no public links are involved ──────────────────────────────────────
 * Filen can mint public share links, but we never ask it to. Files must be
 * served from our own domain, so the only operations needed are authenticated
 * upload and authenticated download; the download proxy at `api/file.ts`
 * fetches the bytes server-side and streams them to the caller. Two things
 * follow from that, both good:
 *
 *   1. The storage vendor never appears in a URL a user sees, which is the
 *      same reasoning as D-020 (the status page not naming the backend).
 *   2. Filen's end-to-end encryption stops being awkward. A public link on an
 *      E2EE service has to carry the decryption key in the URL fragment; here
 *      the SDK decrypts server-side and the key never leaves the function.
 *
 * ── Cost of the credential ────────────────────────────────────────────────
 * Logging in needs the account email and password, which is a broader secret
 * than a scoped bucket key: it grants the whole account, not one prefix. Use a
 * dedicated Filen account for this and nothing else, and never the personal
 * one. Recorded in D-024.
 *
 * The SDK is ~5 MB, so it is imported dynamically and only when credentials
 * are present. A deployment with no storage configured never loads it.
 */

const ROOT = "/pdfly-api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type FilenFs = {
  writeFile(args: { path: string; content: Buffer }): Promise<unknown>;
  readFile(args: { path: string }): Promise<Buffer>;
  unlink(args: { path: string; permanent?: boolean }): Promise<unknown>;
  stat(args: { path: string }): Promise<unknown>;
  mkdir(args: { path: string }): Promise<unknown>;
};

let sdkPromise: Promise<FilenFs> | null = null;

/**
 * Logs in once per warm function instance.
 *
 * Cached as a promise, not a value, so concurrent requests during a cold start
 * share a single login instead of racing to authenticate several times — Filen
 * rate-limits logins, and a burst of PDF requests would otherwise trip it.
 */
function filenFs(email: string, password: string, twoFactorCode?: string): Promise<FilenFs> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    const mod: any = await import("@filen/sdk");
    const FilenSDK = mod.default?.default ?? mod.default;

    const sdk = new FilenSDK({
      metadataCache: true,
      // No socket in a serverless function: nothing is listening for push
      // events, and an open connection only delays the response finishing.
      connectToSocket: false,
    });

    await sdk.login({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}) });

    const fs = sdk.fs() as FilenFs;
    // Idempotent, and cheap once the metadata cache is warm.
    await fs.mkdir({ path: ROOT }).catch(() => undefined);
    return fs;
  })().catch((err) => {
    // Reset so the next invocation retries rather than caching a failed login
    // for the life of the instance.
    sdkPromise = null;
    throw err;
  });

  return sdkPromise;
}

export interface FilenConfig {
  email: string;
  password: string;
  twoFactorCode?: string;
  /** Builds the on-domain download URL. Injected so this file knows no routes. */
  publicUrlFor: (key: string) => string;
}

export function createFilenProvider(cfg: FilenConfig, ttlSeconds: number): StorageProvider {
  const pathFor = (key: string) => `${ROOT}/${key}`;

  return {
    name: "filen",
    persists: true,

    async upload(key, bytes): Promise<StoredObject | null> {
      /*
       * Never throws. Storage is a backup: the file is already built and is
       * returned inline in the same response regardless, so a Filen outage
       * must cost the caller a download link and not their document. This is
       * the same rule the S3 adapter follows, and storage-test.mjs asserts it
       * for both.
       */
      try {
        const fs = await filenFs(cfg.email, cfg.password, cfg.twoFactorCode);
        await fs.writeFile({ path: pathFor(key), content: Buffer.from(bytes) });
        return {
          key,
          url: cfg.publicUrlFor(key),
          expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        };
      } catch (err) {
        console.error("[storage] filen upload failed:", (err as Error).name);
        return null;
      }
    },

    async getTemporaryLink(key) {
      // Our own domain, never Filen's. The signed token carries the expiry.
      return cfg.publicUrlFor(key);
    },

    async download(key) {
      try {
        const fs = await filenFs(cfg.email, cfg.password, cfg.twoFactorCode);
        return await fs.readFile({ path: pathFor(key) });
      } catch (err) {
        console.error("[storage] filen download failed:", (err as Error).name);
        return null;
      }
    },

    async delete(key) {
      try {
        const fs = await filenFs(cfg.email, cfg.password, cfg.twoFactorCode);
        await fs.unlink({ path: pathFor(key), permanent: true });
      } catch {
        /* a delete that fails is a retention problem, not a request failure */
      }
    },

    async exists(key) {
      try {
        const fs = await filenFs(cfg.email, cfg.password, cfg.twoFactorCode);
        await fs.stat({ path: pathFor(key) });
        return true;
      } catch {
        return false;
      }
    },
  };
}
