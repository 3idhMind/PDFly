import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Same shape the Supabase edge functions used, so existing API clients and the
 * published docs keep working across the migration:
 *   { error: "MACHINE_CODE", message: "human sentence" }
 */
export function fail(res: VercelResponse, status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return res.status(status).json({ error, message, ...extra });
}

export function ok(res: VercelResponse, body: Record<string, unknown>, status = 200) {
  return res.status(status).json(body);
}

/**
 * The public PDF endpoints are meant to be called from anywhere, so `*` is
 * correct for those. Credentialed routes must not use this — they authenticate
 * with a bearer token, not cookies, so there is nothing for a browser to
 * silently attach, but `*` plus credentials would still be a mistake worth
 * never learning the hard way.
 */
export function applyCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

/** Returns true when the request was a preflight and has been answered. */
export function handledPreflight(req: VercelRequest, res: VercelResponse): boolean {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * The operation a namespaced request is asking for, e.g. "basic/merge".
 *
 * ── Why this is a query parameter and not a path segment ──────────────────
 * The first attempt used Vercel's `[...path]` catch-all files
 * (`api/pdf/[...path].ts`). Measured on production, it did not behave as
 * assumed: `/api/pdf/generate` reached the function with `req.query.path`
 * EMPTY, and `/api/pdf/basic/merge` never reached it at all — the platform
 * answered its own 404. Every account and PDF endpoint was dead while
 * `/api/system`, an ordinary file, was fine.
 *
 * So the routing no longer depends on catch-all semantics. Plain files, and
 * vercel.json rewrites the pretty URL into `?op=`:
 *
 *     /api/pdf/basic/merge  ->  /api/pdf?op=basic/merge
 *
 * Rewrites with a `:param*` capture are ordinary, documented behaviour, and
 * `scripts/route-test.mjs` resolves the real vercel.json with the same
 * path-to-regexp Vercel uses, so a routing mistake now fails locally.
 *
 * Accepts an array too: if a segment ever arrives pre-split, joining it back
 * costs nothing and removes a whole class of "worked in one place" bug.
 */
export function operationFrom(req: VercelRequest): string {
  const raw = req.query.op ?? req.query.path;
  const joined = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
  return joined.replace(/^\/+|\/+$/g, "");
}
