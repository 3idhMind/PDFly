import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, adminAuth } from "./_lib/firebase.js";
import { ok, handledPreflight } from "./_lib/http.js";

/**
 * Public health probe for the status page.
 *
 * Each dependency is checked independently and reported separately, so a
 * failure names the thing that is actually broken instead of collapsing to
 * "something is down". Always returns 200 — the body carries the verdict.
 * A status page that itself 500s tells you nothing.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const started = Date.now();

  const probe = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      await fn();
      return { name, ok: true, latencyMs: Date.now() - t };
    } catch (err) {
      // Names only — never the message, which can carry connection strings.
      return { name, ok: false, latencyMs: Date.now() - t, error: (err as Error).name };
    }
  };

  const services = await Promise.all([
    probe("api", async () => true),
    // Cheapest possible round trip that still proves credentials and reachability.
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
