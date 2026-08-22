import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, ok } from "../http.js";
import { requireUser } from "../requireUser.js";
import { db } from "../firebase.js";
import { createFileToken } from "../fileToken.js";

/**
 * GET /api/account/documents — the caller's still-retrievable API output.
 *
 * ── Why this is a short list, and always will be ──────────────────────────
 * Files live for RETENTION_SECONDS (one hour by default) and are then deleted
 * for real. So this endpoint is not a document history; it is "what can still
 * be downloaded right now". The UI says so plainly rather than presenting an
 * empty list as a malfunction. Anything made in the browser never reaches a
 * server and so can never appear here.
 *
 * ── Why the query has no range clause ─────────────────────────────────────
 * `where(uid) + where(expiresAt >)` would need a composite index. Retention is
 * an hour, so a single account's live rows are countable on one hand; fetching
 * by uid alone and dropping expired rows in memory costs one index we don't
 * have to create and cannot get out of sync.
 *
 * Tokens are minted fresh on every call with only the file's *remaining* life
 * as their TTL. Reusing the upload-time token would hand back a link already
 * partly spent, and a full-hour TTL would outlive the object it points at.
 */

const STORED_FILES = "storedFiles";
const SCAN_LIMIT = 100;

/** `<uid>/<day>/<rand>-<filename>` → `<filename>`. */
function filenameFrom(key: string): string {
  const last = key.slice(key.lastIndexOf("/") + 1);
  const dash = last.indexOf("-");
  return dash === -1 ? last : last.slice(dash + 1);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET.");

  const caller = await requireUser(req, res);
  if (!caller) return; // requireUser already answered

  let snap;
  try {
    snap = await db().collection(STORED_FILES).where("uid", "==", caller.uid).limit(SCAN_LIMIT).get();
  } catch (err) {
    console.error("[documents] query failed:", (err as Error).name);
    return fail(res, 503, "STORAGE_UNAVAILABLE", "Could not read your documents right now.");
  }

  const now = Date.now();

  const documents = snap.docs
    .map((doc) => {
      const d = doc.data() as { key?: string; expiresAt?: string; size?: number; createdAt?: string };
      if (!d.key || !d.expiresAt) return null;

      // Chunked-upload parts are indexed under `_parts/` so the retention sweep
      // can reach abandoned ones. They are inputs mid-flight, not documents, and
      // listing them would show a user four meaningless fragments of their own
      // file next to the finished one.
      if (d.key.startsWith("_parts/")) return null;

      const expiresMs = Date.parse(d.expiresAt);
      // Expired rows are still here until the sweep reaches them; they are not
      // downloadable, so they are not documents as far as the caller is concerned.
      if (!Number.isFinite(expiresMs) || expiresMs <= now) return null;

      const remaining = Math.floor((expiresMs - now) / 1000);
      return {
        name: filenameFrom(d.key),
        size: typeof d.size === "number" ? d.size : null,
        created_at: d.createdAt ?? null,
        expires_at: d.expiresAt,
        expires_in_seconds: remaining,
        download_url: `/api/file/${createFileToken(d.key, remaining)}`,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return ok(res, { documents });
}
