import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../_lib/requireUser.js";
import { fail, ok, handledPreflight } from "../_lib/http.js";

/**
 * The caller's own account.
 *
 *   GET    /api/account/me      identity and whether this account is the admin
 *   GET    /api/account/keys    list this account's API keys
 *   POST   /api/account/keys    mint one, returned exactly once
 *   DELETE /api/account/keys?id=<keyId>   revoke permanently
 *
 * Grouped into one function for the same reason as the PDF namespace: each
 * file under `api/` costs one of the twelve Hobby slots. Key management is
 * loaded dynamically so a `/me` call, which happens on nearly every page that
 * renders account state, does not pull in the key generation and hashing code.
 *
 * Old paths `/api/me` and `/api/keys` are rewritten here by vercel.json.
 */

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const raw = req.query.path;
  const key = (Array.isArray(raw) ? raw.join("/") : String(raw ?? "")).replace(/^\/+|\/+$/g, "");

  if (key === "keys") {
    const mod = await import("../_lib/handlers/keys.js");
    return (mod.default as Handler)(req, res);
  }

  if (key === "me") {
    const caller = await requireUser(req, res);
    if (!caller) return; // requireUser already answered
    // Deliberately a boolean and nothing more. Returning the admin address here
    // would publish it to every signed-in visitor.
    return ok(res, { uid: caller.uid, authType: caller.authType, isAdmin: caller.isAdmin });
  }

  return fail(res, 404, "UNKNOWN_OPERATION", `No account route at /api/account/${key}.`, {
    available: ["/api/account/me", "/api/account/keys"],
  });
}
