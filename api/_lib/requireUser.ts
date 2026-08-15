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
  /**
   * Capability list carried by an API key. Empty for ID tokens, whose rights
   * come from the account itself. `blog:write` is what lets a key publish to
   * the site's own blog, so an ordinary developer key can never post content.
   */
  scopes: string[];
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
      scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
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
      // Two independent routes to admin, and the env one is the operational one.
      //
      // A custom claim is the "proper" Firebase mechanism, but setting it needs
      // an out-of-band Admin SDK call that nothing in this project performs, so
      // in practice nobody was ever an admin. ADMIN_EMAIL closes that gap
      // without hardcoding an identity into the source: whoever the deployment
      // names is the admin, and changing it is an env edit and a redeploy.
      //
      // Safe because `decoded` came out of verifyIdToken — the email is
      // Firebase-signed, not client-supplied. Compared case-insensitively
      // because Google normalises addresses and dashboards do not.
      // emailVerified is required so an unverified signup on the same address
      // can never inherit admin.
      isAdmin: decoded.admin === true || isAdminEmail(decoded.email, decoded.email_verified),
      scopes: [], // an ID token's rights come from the account, not a scope list
    };
  } catch {
    fail(res, 401, "INVALID_TOKEN", "Session is invalid or has expired. Sign in again.");
    return null;
  }
}

/**
 * Does this caller belong to the admin account?
 *
 * `caller.isAdmin` is decided at authentication time and is always false for an
 * API key, because the key document does not carry the owner's email and
 * reading it on every request would put a Firestore lookup in front of every
 * PDF generated. This resolves it on demand instead, so only the handful of
 * admin-gated routes pay for it.
 *
 * One API, not two: a key minted by the admin account can publish blog posts.
 * A key minted by anyone else cannot, no matter what it asks for — the answer
 * comes from the owner's Firebase-verified email, never from the request.
 *
 * NOT used for the feedback inbox or the security log. Those carry other
 * users' email addresses, and an API key is a long-lived string that ends up in
 * scripts, CI and shell history; those two stay ID-token-only so reading other
 * people's data always requires an interactive sign-in.
 */
export async function isAdminAccount(caller: Caller): Promise<boolean> {
  if (caller.isAdmin) return true; // ID token, already established
  if (caller.authType !== "apiKey") return false;
  try {
    const user = await adminAuth().getUser(caller.uid);
    return isAdminEmail(user.email, user.emailVerified);
  } catch {
    return false;
  }
}

/**
 * True when this Firebase-verified email is the deployment's admin.
 *
 * ADMIN_EMAIL is deliberately NOT `VITE_`-prefixed: a `VITE_` var is compiled
 * into the browser bundle, which would publish the owner's address to every
 * visitor. The client never learns this value — it asks `/api/me` instead.
 *
 * Supports a comma-separated list so a second operator can be added without a
 * code change.
 */
export function isAdminEmail(email?: string, emailVerified?: boolean): boolean {
  if (!email || emailVerified === false) return false;
  const allowed = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/** Convenience path to the caller's per-product document. */
export function productRef(uid: string) {
  return db().collection("users").doc(uid).collection("products").doc(PRODUCT_ID);
}
