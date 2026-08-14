import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { db, PRODUCT_ID, DEFAULT_RATE_LIMIT_PER_MIN } from "./_lib/firebase.js";
import { generateApiKey } from "./_lib/apiKeys.js";
import { requireUser } from "./_lib/requireUser.js";
import { fail, ok, handledPreflight } from "./_lib/http.js";

/** Enough for real use, low enough that a runaway script can't fill a collection. */
const MAX_KEYS_PER_USER = 10;

/**
 * API key management.
 *
 *   GET    /api/keys              list the caller's keys (never the raw key)
 *   POST   /api/keys  {name}      create one — returns the raw key ONCE
 *   DELETE /api/keys?id=<keyId>   revoke, permanently
 *
 * Signed-in users only. An API key cannot be used to mint or revoke API keys —
 * otherwise one leaked key becomes permanent, self-renewing access, and
 * revoking the original would not help.
 *
 * The client never touches Firestore for any of this. `apiKeys` denies all
 * client reads and writes in the security rules, so everything routes through
 * here. That is what fixes the flaw in the Supabase version, where the RLS
 * policy let a user UPDATE their own key row — including its rate limit.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const caller = await requireUser(req, res);
  if (!caller) return;

  if (caller.authType !== "idToken") {
    return fail(res, 403, "FORBIDDEN", "API keys can only be managed while signed in, not with an API key.");
  }

  const keys = db().collection("apiKeys");

  try {
    if (req.method === "GET") {
      const snap = await keys.where("uid", "==", caller.uid).get();
      const list = snap.docs
        .map((d) => {
          const k = d.data();
          return {
            keyId: k.keyId,
            name: k.name,
            keyPrefix: k.keyPrefix,
            active: k.active !== false,
            scopes: k.scopes ?? [],
            rateLimitPerMin: k.rateLimitPerMin ?? DEFAULT_RATE_LIMIT_PER_MIN,
            createdAt: k.createdAt?.toDate?.()?.toISOString() ?? null,
            lastUsedAt: k.lastUsedAt?.toDate?.()?.toISOString() ?? null,
          };
        })
        // Sorted here rather than in Firestore so listing needs no composite
        // index. A user has at most MAX_KEYS_PER_USER of them.
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      return ok(res, { keys: list });
    }

    if (req.method === "POST") {
      const name = String((req.body?.name ?? "")).trim();
      if (!name) {
        return fail(res, 400, "INVALID_INPUT", "A name is required so you can tell your keys apart.");
      }
      if (name.length > 60) {
        return fail(res, 400, "INVALID_INPUT", "Key name must be 60 characters or fewer.");
      }

      const existing = await keys.where("uid", "==", caller.uid).count().get();
      if (existing.data().count >= MAX_KEYS_PER_USER) {
        return fail(res, 429, "LIMIT_EXCEEDED", `You can have at most ${MAX_KEYS_PER_USER} API keys. Revoke one first.`);
      }

      const generated = generateApiKey();
      const keyId = crypto.randomUUID();

      // Document ID is the hash: verification becomes a get-by-id.
      await keys.doc(generated.hash).set({
        keyId,
        uid: caller.uid,
        productId: PRODUCT_ID,
        name,
        keyPrefix: generated.prefix,
        active: true,
        // `blog:write` publishes to the site's own blog, so only the admin may
        // mint a key that carries it, and it must be asked for explicitly —
        // never handed out by default with an ordinary developer key.
        scopes:
          caller.isAdmin && req.body?.scopes?.includes("blog:write")
            ? ["pdf:generate", "blog:write"]
            : ["pdf:generate"],
        rateLimitPerMin: DEFAULT_RATE_LIMIT_PER_MIN,
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null,
      });

      // The only moment `raw` ever leaves this process. Not logged anywhere.
      return ok(
        res,
        {
          key: generated.raw,
          keyId,
          keyPrefix: generated.prefix,
          name,
          warning: "Copy this key now. It is hashed before storage and cannot be shown again.",
        },
        201,
      );
    }

    if (req.method === "DELETE") {
      const keyId = String(req.query.id ?? "");
      if (!keyId) return fail(res, 400, "INVALID_INPUT", "Missing ?id=<keyId>.");

      // Scoped to the caller, so one user can never revoke another's key.
      const snap = await keys.where("uid", "==", caller.uid).get();
      const target = snap.docs.find((d) => d.data().keyId === keyId);
      if (!target) return fail(res, 404, "NOT_FOUND", "No such API key on this account.");

      // Hard delete, not a flag. Only the hash was ever stored, so once the
      // document is gone the key is unrecoverable by anyone, including us —
      // which is what "irreversible" has to mean. Verification is a lookup on
      // this exact document, so revocation takes effect on the next request.
      await target.ref.delete();
      return ok(res, { revoked: true, keyId });
    }

    return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET, POST or DELETE.");
  } catch (err) {
    // Never echo the error body — it can contain request contents.
    console.error("[api/keys] failed:", (err as Error).name);
    return fail(res, 500, "INTERNAL_ERROR", "Something went wrong handling that request.");
  }
}
