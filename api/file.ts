import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "./_lib/storage.js";
import { verifyFileToken } from "./_lib/fileToken.js";
import { fail, handledPreflight, operationFrom } from "./_lib/http.js";

/**
 * Serves a stored file from our own domain.
 *
 *     GET /api/file/<token>
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * A download URL must belong to PDFly, not to whichever storage provider
 * happens to hold the bytes this month. Three reasons, in order of weight:
 *
 *   1. A user handed a link to a third-party domain has no way to tell whether
 *      it is really ours. That is a phishing pattern, not a convenience.
 *   2. The vendor stays private, the same reasoning as D-020 — the status page
 *      no longer names the backend either.
 *   3. Changing provider becomes invisible. Links minted today keep working
 *      when the adapter behind them changes, because the URL never referred to
 *      the provider in the first place.
 *
 * ── Security ──────────────────────────────────────────────────────────────
 * The token is an HMAC over the storage key plus an expiry, so it cannot be
 * forged or edited, and it stops working on its own. Storage keys begin with
 * the owner's uid; without the signature, seeing one link would suggest the
 * shape of everyone else's. Verification is one HMAC and no database read.
 *
 * A bad token, a tampered token and an expired token all get the same 404, so
 * probing cannot distinguish them.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "GET" && req.method !== "HEAD") {
    return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET.");
  }

  const token = operationFrom(req);
  if (!token) return fail(res, 400, "MISSING_TOKEN", "No download token supplied.");

  const verified = verifyFileToken(token);
  if (!verified) {
    return fail(res, 404, "NOT_FOUND", "This download link is invalid or has expired.");
  }

  const provider = storage();
  if (!provider.persists || !provider.download) {
    return fail(
      res,
      404,
      "NOT_FOUND",
      "This deployment does not retain generated files. Files are returned inline in the API response.",
    );
  }

  const bytes = await provider.download(verified.key);
  if (!bytes) {
    // Retention swept it, or the object never landed. Either way the honest
    // answer is that it is gone, not that something broke.
    return fail(res, 404, "NOT_FOUND", "This file is no longer available. Generate it again.");
  }

  // Filename is the last path segment, minus the random prefix that keeps keys
  // unguessable, so the user gets `invoice.pdf` rather than `k3f9a2-invoice.pdf`.
  const last = verified.key.split("/").pop() ?? "file.pdf";
  const filename = last.replace(/^[a-z0-9]{6,10}-/, "");
  const isPdf = filename.toLowerCase().endsWith(".pdf");

  res.setHeader("Content-Type", isPdf ? "application/pdf" : "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
  res.setHeader("Content-Length", String(bytes.length));
  // Private: the URL is a bearer credential, so no shared cache may keep it.
  res.setHeader("Cache-Control", "private, max-age=300");
  // The token already bounds how long this is reachable; say so in the clear.
  res.setHeader("X-Expires-At", new Date(verified.expiresAt).toISOString());

  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).send(Buffer.from(bytes));
}
