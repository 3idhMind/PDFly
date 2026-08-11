/**
 * API key generation and verification.
 *
 * The whole security model in four lines:
 *   1. The key is 256 bits from a CSPRNG. Not guessable, not enumerable.
 *   2. Only SHA-256(key) is ever stored. A database dump yields no usable keys.
 *   3. The raw key is returned exactly once, at creation, and never again.
 *   4. Firestore document ID *is* the hash, so verification is a single
 *      get-by-id — the cheapest lookup Firestore has, on the hottest path.
 *
 * SHA-256 with no salt and no stretching is correct here, unlike for passwords.
 * Stretching exists to slow brute force against low-entropy human input; a
 * 256-bit random key has nothing to brute force. Salting would break the
 * get-by-id lookup for zero benefit — you cannot rainbow-table a keyspace of
 * 2^256.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const KEY_PREFIX = "pdfly_live_";
/** Characters of the key kept in cleartext for display: "pdfly_live_a3f2". */
const DISPLAY_RANDOM_CHARS = 4;

export interface GeneratedKey {
  /** Shown to the user once, then discarded. Never stored, never logged. */
  raw: string;
  /** SHA-256 hex. This is the Firestore document ID. */
  hash: string;
  /** Safe to store and display, e.g. "pdfly_live_a3f2". */
  prefix: string;
}

export function generateApiKey(): GeneratedKey {
  // 32 bytes = 256 bits. base64url keeps it URL- and header-safe with no
  // padding, so nothing downstream has to escape it.
  const random = randomBytes(32).toString("base64url");
  const raw = `${KEY_PREFIX}${random}`;
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: `${KEY_PREFIX}${random.slice(0, DISPLAY_RANDOM_CHARS)}`,
  };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Shape validation only — says nothing about whether the key exists. */
export function looksLikeApiKey(value: string): boolean {
  return (
    typeof value === "string" &&
    value.startsWith(KEY_PREFIX) &&
    value.length >= KEY_PREFIX.length + 40 &&
    value.length <= KEY_PREFIX.length + 64
  );
}

/**
 * Constant-time comparison of two hex hashes.
 *
 * Only meaningful where a comparison is done in application code rather than by
 * a database lookup. Kept because the cleanup-secret style checks elsewhere
 * need it and reimplementing it per call site is how one of them ends up using
 * `===`.
 */
const HEX_ONLY = /^[0-9a-fA-F]+$/;

export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length || a.length === 0 || a.length % 2 !== 0) return false;

  // The hex validation below is NOT optional, and the reason is subtle enough
  // that it was a live bug here until a test caught it:
  //
  //   Buffer.from("zzzz", "hex")  →  <Buffer >   (empty — Node stops decoding
  //                                              at the first invalid char)
  //   Buffer.from("yyyy", "hex")  →  <Buffer >
  //   timingSafeEqual(empty, empty)  →  true
  //
  // So *any* two same-length non-hex strings compared equal. In a function
  // whose entire job is answering "is this secret correct", that is a hole.
  // Validate the alphabet first, then decode.
  if (!HEX_ONLY.test(a) || !HEX_ONLY.test(b)) return false;

  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Redacts anything key-shaped before it can reach a log line. */
export function redact(value: string): string {
  return value.replace(
    new RegExp(`${KEY_PREFIX}[A-Za-z0-9_-]+`, "g"),
    `${KEY_PREFIX}…redacted`,
  );
}
