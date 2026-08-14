import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { db, adminAuth } from "./_lib/firebase.js";
import { redact } from "./_lib/apiKeys.js";
import { fail, ok, handledPreflight } from "./_lib/http.js";

/**
 * Health probe and client crash reports.
 *
 * Merged for the same reason as account.ts: Vercel's Hobby plan caps a
 * deployment at 12 Serverless Functions and each file in `api/` is one. Both of
 * these are tiny, unauthenticated and stateless, and they split cleanly by
 * method, so the merge costs nothing in clarity:
 *
 *     GET  /api/health        -> status probe
 *     POST /api/report-issue  -> crash report
 *
 * vercel.json rewrites both public paths onto this file, so the URLs the status
 * page and the client error handler already call are unchanged.
 */

const MAX_FIELD = 2000;

/** Trims, caps length, and strips anything key-shaped before it is persisted. */
function clean(value: unknown, limit = MAX_FIELD): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return redact(trimmed.slice(0, limit));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  /* ------------------------------------------------------- crash reports */
  /**
   * Anonymous by design: a crash report is most useful from exactly the users
   * least likely to be signed in.
   *
   * Deliberately narrow — message, stack, route, tool. Never file contents, and
   * every string goes through redact(), so a stack trace that happens to carry
   * an API key cannot write one into the database.
   */
  if (req.method === "POST") {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = clean(body.message, 500);
      if (!message) return fail(res, 400, "INVALID_INPUT", "A message is required.");

      const severity = ["info", "warning", "critical"].includes(String(body.severity))
        ? String(body.severity)
        : "critical";

      await db().collection("errors").add({
        message,
        stack: clean(body.stack, MAX_FIELD),
        route: clean(body.route, 200),
        tool: clean(body.tool, 60),
        type: clean(body.type, 60) ?? "client_failure",
        severity,
        userAgent: clean(req.headers["user-agent"], 300),
        createdAt: FieldValue.serverTimestamp(),
      });

      return ok(res, { received: true });
    } catch (err) {
      console.error("[api/system] report failed:", (err as Error).name);
      // Reporting a failure must never itself become a visible failure.
      return ok(res, { received: false });
    }
  }

  if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET or POST.");

  /* -------------------------------------------------------- health probe */
  /**
   * Each dependency is checked separately so a failure names the thing that is
   * actually broken. Always answers 200 with the verdict in the body — a status
   * endpoint that 500s tells a visitor nothing, and the badge in the footer
   * would be unable to distinguish "down" from "unreachable".
   */
  const started = Date.now();

  const probe = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      await fn();
      return { name, ok: true, latencyMs: Date.now() - t };
    } catch (err) {
      // Names only — a message can carry connection strings.
      return { name, ok: false, latencyMs: Date.now() - t, error: (err as Error).name };
    }
  };

  const services = await Promise.all([
    probe("api", async () => true),
    // Cheapest round trip that still proves credentials and reachability.
    probe("firestore", () => db().collection("_health").limit(1).get()),
    probe("auth", () => adminAuth().listUsers(1)),
  ]);

  return ok(res, {
    status: services.every((s) => s.ok) ? "operational" : "degraded",
    services,
    totalMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  });
}
