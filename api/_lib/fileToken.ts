import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, self-contained download tokens.
 *
 * ── Why a token and not a database row ────────────────────────────────────
 * A download link has to survive without a lookup: adding a Firestore read to
 * every file fetch costs money on a path that is pure bandwidth and is exactly
 * the sort of per-request read `identity.ts` warns about. The token therefore
 * carries the storage key and its expiry, signed, so verifying it is one HMAC
 * and no I/O.
 *
 * ── Why the key is not simply the URL ─────────────────────────────────────
 * Storage keys start with the owner's uid. An unsigned key in a URL would let
 * anyone who saw one guess a sibling path, and would let a user hold a link
 * open past the retention window. The signature makes the key unguessable and
 * the embedded expiry makes it temporary, without either being stored.
 *
 * The secret is FILE_TOKEN_SECRET, falling back to the Firebase private key —
 * which is already required, already secret, and already present in every
 * deployment, so a missing variable cannot silently produce forgeable tokens.
 */

function secret(): string {
  const explicit = process.env.FILE_TOKEN_SECRET?.trim();
  if (explicit) return explicit;
  const fallback = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (fallback) return fallback;
  // Only reachable in a deployment with no Firebase either, where nothing
  // works anyway. Failing loudly beats signing with an empty string.
  throw new Error("FILE_TOKEN_SECRET (or FIREBASE_PRIVATE_KEY) must be set");
}

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const unb64url = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

/** `<key>.<expiryEpochSeconds>.<signature>`, all base64url. */
export function createFileToken(key: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${b64url(key)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export interface VerifiedToken {
  key: string;
  expiresAt: number;
}

/**
 * Returns the storage key, or null for anything that is not a valid, unexpired
 * token. Callers get one answer for "forged", "tampered" and "expired" so a
 * probe cannot tell which of the three it hit.
 */
export function verifyFileToken(token: string): VerifiedToken | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedKey, expStr, signature] = parts;
  const payload = `${encodedKey}.${expStr}`;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and the length itself is not secret.
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  try {
    return { key: unb64url(encodedKey), expiresAt: exp * 1000 };
  } catch {
    return null;
  }
}
