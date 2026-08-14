import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/requireUser.js";
import { ok, handledPreflight } from "./_lib/http.js";

/**
 * Who am I, and am I the admin?
 *
 * Exists so the client can render admin UI without ever being told the admin's
 * address. The alternative — a `VITE_ADMIN_EMAIL` the browser compares locally
 * — would publish the owner's email to every visitor in the JS bundle, and
 * would let anyone read off exactly which account to attack.
 *
 * This answer is for *rendering* only. Every admin route re-derives `isAdmin`
 * from the verified ID token itself, so a client that lies here gains nothing.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const caller = await requireUser(req, res);
  if (!caller) return; // requireUser already answered

  return ok(res, {
    uid: caller.uid,
    authType: caller.authType,
    isAdmin: caller.isAdmin,
  });
}
