import { createHash, createHmac } from "node:crypto";
import type { StorageProvider, StoredObject } from "./storage.js";

/**
 * S3-compatible object storage: Backblaze B2, Cloudflare R2, AWS S3.
 *
 * ── Why one adapter covers three providers ────────────────────────────────
 * `_internal/ROADMAP.md` Stage 3 lists filen.io, then Mega, then Backblaze B2,
 * and requires that "Cloudflare R2 later must mean writing one new adapter,
 * nothing else". B2 and R2 both speak the S3 API, so this single adapter
 * satisfies options 3 and 4 of that plan at once and AWS S3 as a bonus.
 * Switching provider is an endpoint change, not a code change.
 *
 * filen.io was researched rather than skipped: its public links do work for a
 * recipient with no account, and they support expiry. The blocker is that its
 * end-to-end encryption means a server that uploads on a user's behalf has to
 * hold the master key in an environment variable, which is a far larger secret
 * to guard than an object-store credential that can be scoped to one bucket
 * and rotated. Recorded as D-023; revisit if the bucket cost ever matters.
 *
 * ── Why SigV4 is implemented here rather than pulling in the AWS SDK ──────
 * `@aws-sdk/client-s3` is several megabytes and lands in the cold start of
 * every PDF request, including the ones that never touch storage. Signing is
 * about eighty lines against `node:crypto`, has no supply chain, and is
 * exercised by `scripts/storage-test.mjs`. Presigned URLs are pure string
 * construction: no network call is needed to mint one.
 */

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256 = (d: string | Uint8Array) => createHash("sha256").update(d).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

interface S3Config {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
}

/** `20260814T091530Z` and `20260814`, the two forms SigV4 needs. */
function stamps(now: Date) {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function signingKey(cfg: S3Config, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

/**
 * A presigned GET URL, valid for `ttlSeconds`.
 *
 * Query-string signing, so the link works in a plain browser with no headers —
 * which is the entire point of handing one to a caller.
 */
function presign(cfg: S3Config, key: string, ttlSeconds: number, now = new Date()): string {
  const { amzDate, dateStamp } = stamps(now);
  const host = new URL(cfg.endpoint).host;
  const canonicalUri = `/${cfg.bucket}/${key.split("/").map(enc).join("/")}`;
  const credential = `${cfg.accessKeyId}/${dateStamp}/${cfg.region}/s3/aws4_request`;

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(ttlSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateStamp}/${cfg.region}/s3/aws4_request`,
    sha256(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(cfg, dateStamp)).update(stringToSign).digest("hex");
  return `${cfg.endpoint.replace(/\/$/, "")}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Signed headers for a request that carries a body (PUT) or none (DELETE/HEAD). */
function signedHeaders(
  cfg: S3Config,
  method: string,
  key: string,
  body: Uint8Array | null,
  contentType?: string,
  now = new Date(),
): Record<string, string> {
  const { amzDate, dateStamp } = stamps(now);
  const host = new URL(cfg.endpoint).host;
  const canonicalUri = `/${cfg.bucket}/${key.split("/").map(enc).join("/")}`;
  const payloadHash = body ? sha256(body) : sha256("");

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaderList = sortedKeys.join(";");

  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaderList, payloadHash].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateStamp}/${cfg.region}/s3/aws4_request`,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(cfg, dateStamp)).update(stringToSign).digest("hex");

  return {
    ...headers,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${dateStamp}/${cfg.region}/s3/aws4_request, ` +
      `SignedHeaders=${signedHeaderList}, Signature=${signature}`,
  };
}

export function createS3Provider(cfg: S3Config, ttlSeconds: number): StorageProvider {
  const url = (key: string) => `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${key.split("/").map(enc).join("/")}`;

  return {
    name: "s3",
    persists: true,

    async upload(key, bytes, contentType): Promise<StoredObject | null> {
      /*
       * Every failure path returns null rather than throwing.
       *
       * Storage is a backup, not the delivery mechanism: the PDF is already
       * built and is returned inline regardless. A DNS failure or a 403 from a
       * misconfigured bucket must degrade to the "download it now" contract,
       * never turn a working PDF request into a 500. scripts/storage-test.mjs
       * asserts this against an unreachable host, which is how the missing
       * try/catch here was caught before it ever reached production.
       */
      let res: Response;
      try {
        res = await fetch(url(key), {
          method: "PUT",
          headers: signedHeaders(cfg, "PUT", key, bytes, contentType),
          // Node 18+ fetch accepts a Uint8Array body directly.
          body: bytes,
        });
      } catch (err) {
        console.error("[storage] upload unreachable:", (err as Error).name);
        return null;
      }
      if (!res.ok) {
        console.error(`[storage] upload rejected ${res.status}`);
        return null;
      }
      return {
        key,
        url: presign(cfg, key, ttlSeconds),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
    },

    async getTemporaryLink(key, ttl = ttlSeconds) {
      return presign(cfg, key, ttl);
    },

    async delete(key) {
      await fetch(url(key), { method: "DELETE", headers: signedHeaders(cfg, "DELETE", key, null) }).catch(
        () => undefined,
      );
    },

    async exists(key) {
      try {
        const res = await fetch(url(key), { method: "HEAD", headers: signedHeaders(cfg, "HEAD", key, null) });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

/** Exported for scripts/storage-test.mjs, which checks the signature offline. */
export const __testing = { presign, signedHeaders, sha256 };
