import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_lib/firebase";
import { requireUser } from "./_lib/requireUser";
import { fail, ok, handledPreflight } from "./_lib/http";

const LIMIT = 200;

/**
 * Admin feed for the security dashboard.
 *
 * Gated on the `admin` custom claim, re-verified here from the signed ID token.
 * `useIsAdmin` on the client only decides whether to render the page — it is
 * not a security boundary, and this is the boundary.
 *
 * API keys are rejected even if their owner is an admin: an admin's leaked
 * integration key should not be able to read the security log.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET.");

  const caller = await requireUser(req, res);
  if (!caller) return;

  if (caller.authType !== "idToken" || !caller.isAdmin) {
    // Same response for "not an admin" and "wrong credential type" — no hint
    // that this endpoint exists and is merely out of reach.
    return fail(res, 404, "NOT_FOUND", "Not found.");
  }

  try {
    const [errorsSnap, logsSnap] = await Promise.all([
      db().collection("errors").orderBy("createdAt", "desc").limit(LIMIT).get(),
      db().collection("apiLogs").orderBy("createdAt", "desc").limit(LIMIT).get()
        .catch(() => null), // collection may not exist until the API is ported
    ]);

    const iso = (v: unknown) =>
      (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null;

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
    console.error("[api/admin-events] failed:", (err as Error).name);
    return fail(res, 500, "INTERNAL_ERROR", "Could not load the security feed.");
  }
}
