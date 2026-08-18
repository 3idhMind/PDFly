import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { db, adminAuth } from "./_lib/firebase.js";
import { redact } from "./_lib/apiKeys.js";
import { fail, ok, handledPreflight, operationFrom } from "./_lib/http.js";
import { sweepExpired, storage } from "./_lib/storage.js";

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

  /* ------------------------------------------------------- retention sweep */
  /**
   * GET /api/system?op=sweep
   *
   * Backstop for the opportunistic sweep that runs after every upload. That
   * covers any account actively generating files; this covers a quiet period
   * where nothing is uploaded and expired objects would otherwise sit around.
   *
   * Vercel's cron calls this daily, which is the finest granularity the Hobby
   * plan offers. Retention is one hour, so the cron alone would be far too
   * coarse — it is the safety net, not the mechanism.
   *
   * Protected by CRON_SECRET when one is set, because an unauthenticated sweep
   * endpoint is a free way for anyone to make us do work. Vercel sends the
   * secret as a Bearer token on scheduled invocations.
   */
  if (operationFrom(req) === "sweep") {
    const secret = process.env.CRON_SECRET?.trim();
    if (secret) {
      const header = req.headers.authorization;
      if (header !== `Bearer ${secret}`) return fail(res, 401, "UNAUTHENTICATED", "Not authorised.");
    }
    const result = await sweepExpired(200);
    return ok(res, { swept: true, ...result });
  }

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
      // Neither the message nor the error class is returned. A message can
      // carry connection strings, and a class name like FirebaseAppError names
      // the vendor just as loudly as the service label used to.
      void err;
      return { name, ok: false, latencyMs: Date.now() - t };
    }
  };

  /*
   * Service names here are deliberately generic.
   *
   * They used to be "firestore" and "auth", which published our backend vendor
   * to anyone who opened /api/health — and the status page rendered
   * "Database: Firestore" straight onto a public page. Naming the provider
   * tells an attacker which console to phish, which CVEs to try and which
   * misconfigurations to probe for, and it buys a visitor nothing: someone
   * checking a status page wants to know whether it works, not what it runs on.
   *
   * The probe itself is unchanged and still hits the real dependency. Only the
   * label is abstract.
   */
  const services = await Promise.all([
    probe("api", async () => true),
    // Cheapest round trip that still proves credentials and reachability.
    probe("database", () => db().collection("_health").limit(1).get()),
    probe("authentication", () => adminAuth().listUsers(1)),
  ]);

  return ok(res, {
    status: services.every((s) => s.ok) ? "operational" : "degraded",
    services,
    /*
     * Lets the frontend show an accurate retention message instead of a
     * blanket warning. `.persists` is a boolean the provider already exposes;
     * deliberately not `.name`, which would re-leak the storage vendor the
     * same way "firestore"/"auth" used to leak the backend (see D-020).
     * Cheap: storage() just reads env vars once and caches the result, no
     * extra network call.
     */
    storage: { persists: storage().persists },
    totalMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  });
}
