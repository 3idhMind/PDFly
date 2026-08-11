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
