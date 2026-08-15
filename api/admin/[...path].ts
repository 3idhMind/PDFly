import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/firebase.js";
import { requireUser, isAdminAccount } from "../_lib/requireUser.js";
import { fail, ok, handledPreflight } from "../_lib/http.js";

/**
 * Admin-only reads.
 *
 *   GET    /api/admin/feedback        the feedback inbox
 *   DELETE /api/admin/feedback?id=    remove one entry
 *   GET    /api/admin/events          crash reports and API logs
 *   GET    /api/admin/activity        who did what, across the account
 *
 * ── Why an API key cannot reach these ─────────────────────────────────────
 * Blog publishing accepts an admin-owned API key, because a post is public
 * content and the write is auditable. These three are different: they return
 * other people's email addresses and error traces. An API key is a long-lived
 * string that ends up in scripts, CI variables and shell history, so reading
 * other users' data always requires an interactive sign-in. The gate is
 * therefore `authType === "idToken"` AND admin, not just admin.
 */

const LIMIT = 200;
const iso = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const raw = req.query.path;
  const key = (Array.isArray(raw) ? raw.join("/") : String(raw ?? "")).replace(/^\/+|\/+$/g, "");

  const caller = await requireUser(req, res);
  if (!caller) return;

  if (caller.authType !== "idToken" || !(await isAdminAccount(caller))) {
    // Identical answer for "not admin" and "wrong credential type" — this does
    // not confirm the route exists and is merely out of reach.
    return fail(res, 404, "NOT_FOUND", "Not found.");
  }

  /* -------------------------------------------------------------- feedback */
  if (key === "feedback") {
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

  /* -------------------------------------------------------------- activity */
  // The audit trail written by api/_lib/activity.ts: key creation and
  // revocation, blog publishes, quota and rate-limit trips. This is the answer
  // to "who created this API key, and when", which had no answer before.
  if (key === "activity") {
    if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET.");
    const uid = typeof req.query.uid === "string" ? req.query.uid : caller.uid;
    const snap = await db()
      .collection("users")
      .doc(uid)
      .collection("activity")
      .orderBy("at", "desc")
      .limit(LIMIT)
      .get();

    return ok(res, {
      uid,
      count: snap.size,
      activity: snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          type: v.type,
          at: iso(v.at),
          authType: v.authType ?? null,
          source: v.source ?? "client",
          keyId: v.keyId ?? null,
          keyName: v.keyName ?? null,
          keyPrefix: v.keyPrefix ?? null,
          slug: v.slug ?? null,
          title: v.title ?? null,
        };
      }),
    });
  }

  /* ---------------------------------------------------------------- events */
  if (key === "events") {
    if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET.");
    try {
      const [errorsSnap, logsSnap] = await Promise.all([
        db().collection("errors").orderBy("createdAt", "desc").limit(LIMIT).get(),
        db()
          .collection("apiLogs")
          .orderBy("createdAt", "desc")
          .limit(LIMIT)
          .get()
          .catch(() => null), // may not exist yet
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
      console.error("[api/admin/events] failed:", (err as Error).name);
      return fail(res, 500, "INTERNAL_ERROR", "Could not load the security feed.");
    }
  }

  /* ------------------------------------------------------------------ blog */
  if (key === "blog") {
    const mod = await import("../_lib/handlers/blogHandler.js");
    return (mod.default as (q: VercelRequest, s: VercelResponse) => Promise<unknown>)(req, res);
  }

  return fail(res, 404, "NOT_FOUND", "Not found.");
}
