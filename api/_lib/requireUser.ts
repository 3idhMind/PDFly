import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminAuth, db, PRODUCT_ID, DEFAULT_RATE_LIMIT_PER_MIN } from "./firebase.js";
import { hashApiKey, looksLikeApiKey } from "./apiKeys.js";
import { fail } from "./http.js";

export interface Caller {
  uid: string;
  authType: "idToken" | "apiKey";
  /** Present only for apiKey callers. */
  keyDocId?: string;
  rateLimitPerMin: number;
  isAdmin: boolean;
}

function bearer(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header)) return null;
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length >= 20 ? token : null;
}

/**
 * Resolves the caller from an Authorization header. Two credential types:
 *
 *  - A PDFly API key (`pdfly_live_…`) — used by developers calling the API.
 *    Verified by hashing and reading `apiKeys/{hash}` by document ID.
 *  - A Firebase ID token — used by the web app on the user's behalf.
 *    Verified against Google's signing keys by the Admin SDK.
 *
 * Deciding between them on the key prefix, rather than trying one and falling
 * back, matters: a fallback path would let a malformed API key be reinterpreted
 * as a JWT and produce confusing failures on the wrong branch.
 *
 * Returns null and writes the response when authentication fails.
 */
export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<Caller | null> {
  const token = bearer(req);
  if (!token) {
    fail(res, 401, "UNAUTHENTICATED", "Missing or malformed Authorization header. Use: Authorization: Bearer <token>");
    return null;
  }

  if (looksLikeApiKey(token)) {
    const snap = await db().collection("apiKeys").doc(hashApiKey(token)).get();
    if (!snap.exists) {
      // Deliberately identical message for "never existed" and "revoked" —
      // no oracle telling an attacker which guesses were once valid.
      fail(res, 401, "INVALID_KEY", "API key is invalid or has been revoked.");
      return null;
    }
    const data = snap.data()!;
    if (data.active === false) {
      fail(res, 401, "INVALID_KEY", "API key is invalid or has been revoked.");
      return null;
    }
    return {
      uid: data.uid as string,
      authType: "apiKey",
      keyDocId: snap.id,
      rateLimitPerMin: (data.rateLimitPerMin as number) ?? DEFAULT_RATE_LIMIT_PER_MIN,
      isAdmin: false, // API keys never carry admin rights, regardless of owner.
    };
  }

  try {
    // checkRevoked:true costs an extra lookup but means signing a user out
    // actually invalidates their token instead of leaving it good for an hour.
    const decoded = await adminAuth().verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      authType: "idToken",
      rateLimitPerMin: DEFAULT_RATE_LIMIT_PER_MIN,
      isAdmin: decoded.admin === true,
    };
  } catch {
    fail(res, 401, "INVALID_TOKEN", "Session is invalid or has expired. Sign in again.");
    return null;
  }
}

/** Convenience path to the caller's per-product document. */
export function productRef(uid: string) {
  return db().collection("users").doc(uid).collection("products").doc(PRODUCT_ID);
}
