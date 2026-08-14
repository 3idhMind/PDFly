import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_lib/firebase.js";
import { requireUser } from "./_lib/requireUser.js";
import { fail, ok, handledPreflight } from "./_lib/http.js";

/**
 * Identity and admin reads, in one function.
 *
 * ── Why three endpoints share a file ──────────────────────────────────────
 * Vercel's Hobby plan allows 12 Serverless Functions per deployment, and every
 * file in `api/` becomes one. Adding /api/me, /api/blog and /api/admin-feedback
 * took the project to 14 and the deployment started failing outright.
 *
 * These three were the right ones to merge: all are small, all are pure reads
 * against Firestore, and all require a Firebase ID token. The PDF endpoints are
 * deliberately left alone — they are heavy, have their own memory profiles, and
 * one of them timing out should not take the others down with it.
 *
 * Public URLs are unchanged. vercel.json rewrites /api/me,
 * /api/admin-feedback and /api/admin-events onto this file, so no client,
 * script or bookmark had to change.
 *
 * Files under `_lib/` do not count toward the limit — the leading underscore
 * tells Vercel they are shared code, not entry points.
 */

const LIMIT = 200;

const iso = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const action = typeof req.query.action === "string" ? req.query.action : "me";

  const caller = await requireUser(req, res);
  if (!caller) return; // requireUser already answered

  /* -------------------------------------------------------------------- me */
  // Cheap enough to be called on every page load that renders admin UI.
  if (action === "me") {
    return ok(res, { uid: caller.uid, authType: caller.authType, isAdmin: caller.isAdmin });
  }

  /* ---------------------------------------------------------------- admin */
  // ID token only. An API key is rejected even when its owner is the admin:
  // keys get pasted into scripts and CI, and neither should be able to read
  // the feedback inbox or the security log.
  if (caller.authType !== "idToken" || !caller.isAdmin) {
    // Same answer for "not admin" and "wrong credential type", so this does not
    // confirm that the endpoint exists and is merely out of reach.
    return fail(res, 404, "NOT_FOUND", "Not found.");
  }

  /* --------------------------------------------------------- feedback box */
  if (action === "feedback") {
    const col = db().collection("feedback");

    if (req.method === "DELETE") {
      const id = typeof req.query.id === "string" ? req.query.id : null;
      if (!id) return fail(res, 400, "MISSING_ID", "Pass ?id=");
      await col.doc(id).delete();
      return ok(res, { deleted: id });
    }
    if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET or DELETE.");

    const snap = await col.orderBy("createdAt", "desc").limit(LIMIT).get();
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
          createdAt: iso(v.createdAt),
        };
      }),
    });
  }

  /* ------------------------------------------------------- security feed */
  if (action === "events") {
    if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET.");
    try {
      const [errorsSnap, logsSnap] = await Promise.all([
        db().collection("errors").orderBy("createdAt", "desc").limit(LIMIT).get(),
        db()
          .collection("apiLogs")
          .orderBy("createdAt", "desc")
          .limit(LIMIT)
          .get()
          .catch(() => null), // collection may not exist yet
      ]);

      return ok(res, {
        events: errorsSnap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            event_type: v.type ?? "client_failure",
            severity: v.severity ?? "critical",
            user_id: v.uid ?? null,
            ip_address: null, // deliberately not collected
            user_agent: v.userAgent ?? null,
            details: { message: v.message, stack: v.stack, route: v.route, tool: v.tool },
            created_at: iso(v.createdAt),
          };
        }),
        logs: (logsSnap?.docs ?? []).map((d) => {
          const v = d.data();
          return {
            id: d.id,
            request_id: v.requestId ?? d.id,
            endpoint: v.endpoint ?? "",
            method: v.method ?? "",
            status_code: v.statusCode ?? null,
            latency_ms: v.latencyMs ?? null,
            ip_address: null,
            error: v.error ?? null,
            created_at: iso(v.createdAt),
          };
        }),
      });
    } catch (err) {
      console.error("[api/account?action=events] failed:", (err as Error).name);
      return fail(res, 500, "INTERNAL_ERROR", "Could not load the security feed.");
    }
  }

  return fail(res, 400, "UNKNOWN_ACTION", "action must be me, feedback or events.");
}
