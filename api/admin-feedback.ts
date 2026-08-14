import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_lib/firebase.js";
import { requireUser } from "./_lib/requireUser.js";
import { fail, ok, handledPreflight } from "./_lib/http.js";

/**
 * Feedback inbox, admin only.
 *
 * The `feedback` collection is a write-only drop box in firestore.rules:
 * anyone may submit, nobody may read. That is deliberate — a client-readable
 * inbox would let any visitor enumerate everyone else's messages, including the
 * email addresses they left.
 *
 * The consequence was that submissions were saved correctly and were visible
 * nowhere except the Firebase console. This endpoint is the read side, behind
 * the Admin SDK, which bypasses rules without weakening them.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const caller = await requireUser(req, res);
  if (!caller) return;
  // ID token only: an API key must never be able to read the inbox, even the
  // admin's own key, because keys get pasted into scripts and shared.
  if (caller.authType !== "idToken" || !caller.isAdmin) {
    return fail(res, 403, "FORBIDDEN", "Admin only.");
  }

  const col = db().collection("feedback");

  if (req.method === "DELETE") {
    const id = typeof req.query.id === "string" ? req.query.id : null;
    if (!id) return fail(res, 400, "MISSING_ID", "Pass ?id=");
    await col.doc(id).delete();
    return ok(res, { deleted: id });
  }

  if (req.method !== "GET") {
    return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET or DELETE.");
  }

  const snap = await col.orderBy("createdAt", "desc").limit(200).get();

  return ok(res, {
    count: snap.size,
    feedback: snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        name: v.name || null,
        email: v.email || null,
        message: v.message,
        rating: v.rating ?? null,
        path: v.path || null,
        // Firestore Timestamp -> ISO, so the client does not need the SDK.
        createdAt: v.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    }),
  });
}
