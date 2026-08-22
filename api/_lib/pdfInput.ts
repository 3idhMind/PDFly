import { promises as dns } from "node:dns";
import { verifyFileToken } from "./fileToken.js";
import { storage } from "./storage.js";

/**
 * Shared input-validation for every handler that accepts a PDF (or fetches one
 * from a URL on the caller's behalf): the SSRF guard and the magic-byte check.
 *
 * This used to be five byte-for-byte copies, one pasted into each of merge.ts,
 * split.ts, compress.ts, toImages.ts and fromImages.ts (fallback.ts carried a
 * sixth copy of just the magic-byte half). That is exactly the setup where a
 * future security fix — a new blocked IP range, a new bypass discovered in the
 * DNS-rebinding check — gets applied to three of them under deadline and the
 * other two quietly stay vulnerable. Roadmap item O-10.
 */

/** Thrown for anything the caller can fix; the message is safe to return as-is. */
export class InputError extends Error {}

function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipToLong(ip);
  if (n === null) return true; // unparseable means "do not trust it"
  const inRange = (start: string, prefix: number) => {
    const s = ipToLong(start)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (n & mask) === (s & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) || // link-local, incl. the 169.254.169.254 metadata address
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("192.0.0.0", 24) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 4) ||
    inRange("240.0.0.0", 4)
  );
}

function isBlockedIPv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
  if (s.startsWith("fe80:")) return true; // link-local
  if (s.startsWith("::ffff:")) return isBlockedIPv4(s.slice(7)); // v4-mapped
  return false;
}

/**
 * https only, no URL credentials, no private targets — checked both by hostname
 * and by every address the hostname resolves to. The DNS pass is the part that
 * matters: a public name can resolve to 169.254.169.254 and hand the caller the
 * platform's instance metadata. Redirects are refused by the caller's own fetch,
 * since a followed redirect would land somewhere this function never inspected.
 */
export async function assertPublicHttpsUrl(raw: string, label: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new InputError(`${label}: invalid URL`);
  }
  if (u.protocol !== "https:") throw new InputError(`${label}: only https URLs are allowed`);
  if (u.username || u.password) throw new InputError(`${label}: URL credentials are not allowed`);

  const host = u.hostname.replace(/^\[|\]$/g, "");
  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower === "metadata.google.internal"
  ) {
    throw new InputError(`${label}: host is not allowed`);
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIPv4(host)) throw new InputError(`${label}: private/internal IP is not allowed`);
    return;
  }
  if (host.includes(":")) {
    if (isBlockedIPv6(host)) throw new InputError(`${label}: private/internal IP is not allowed`);
    return;
  }

  try {
    const records = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    const ips: string[] = [];
    for (const r of records) if (r.status === "fulfilled") ips.push(...r.value);
    if (ips.length === 0) throw new InputError(`${label}: could not resolve host`);
    for (const ip of ips) {
      if (ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip)) {
        throw new InputError(`${label}: host resolves to a private/internal address`);
      }
    }
  } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError(`${label}: DNS resolution failed`);
  }
}

/** An input of this shape came from /api/pdf/upload rather than the request body. */
export const UPLOAD_REF_PREFIX = "ref:";

export function isUploadRef(input: string): boolean {
  return input.startsWith(UPLOAD_REF_PREFIX);
}

/**
 * Resolves an upload reference to bytes, server-side.
 *
 * ── Why a ref and not simply an https URL ─────────────────────────────────
 * The chunked uploader could hand back a normal `/api/file/<token>` link and
 * every handler would already accept it, since they all fetch https URLs. That
 * costs an HTTP round trip out to our own CDN and back into another function
 * just to read bytes this deployment can already reach, and it drags the
 * response through Vercel's 4.5 MB body cap on the way. Resolving through the
 * storage adapter skips both.
 *
 * The token is the same HMAC used for downloads, so a ref cannot be forged or
 * pointed at another account's key, and it expires on its own. That is also why
 * the SSRF guard does not apply here: the caller never supplies a destination,
 * only a signature we minted.
 */
export async function resolveUploadRef(input: string, label: string): Promise<Uint8Array> {
  const verified = verifyFileToken(input.slice(UPLOAD_REF_PREFIX.length));
  if (!verified) {
    throw new InputError(`${label}: upload reference is invalid or has expired`);
  }
  const provider = storage();
  if (!provider.download) {
    throw new InputError(`${label}: this deployment cannot read uploaded files back`);
  }
  const bytes = await provider.download(verified.key);
  if (!bytes) {
    throw new InputError(`${label}: the uploaded file is no longer available`);
  }
  return new Uint8Array(bytes);
}

/**
 * %PDF magic bytes. Checked on every input, including ones fetched from a URL:
 * without it any byte stream a caller can point us at gets handed to the parser.
 * Searched over the first KB rather than at offset 0 because some producers emit
 * leading whitespace or a BOM.
 */
export function assertLooksLikePdf(bytes: Uint8Array, label: string) {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return;
  }
  throw new InputError(`${label}: not a valid PDF file`);
}
