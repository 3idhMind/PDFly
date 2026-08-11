import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./_lib/firebase";
import { redact } from "./_lib/apiKeys";
import { fail, ok, handledPreflight } from "./_lib/http";

const MAX_FIELD = 2000;

/** Trims, caps length, and strips anything key-shaped before it is persisted. */
function clean(value: unknown, limit = MAX_FIELD): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return redact(trimmed.slice(0, limit));
}

/**
 * Client failure reports. Anonymous by design — a crash report is most useful
 * from the users who are least likely to be signed in.
 *
 * Deliberately narrow: message, stack, route, tool. It never accepts file
 * contents, and every string is passed through redact() so a stack trace that
 * happens to contain an API key cannot write one into the database.
 *
 * Writes to a server-only `errors` collection; the client cannot read it back.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");

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
    console.error("[api/report-issue] failed:", (err as Error).name);
    // Reporting a failure must never itself become a visible failure.
    return ok(res, { received: false });
  }
}
