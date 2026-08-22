import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes, createHash } from "node:crypto";
import { fail, ok } from "../http.js";
import { requireUser, type Caller } from "../requireUser.js";
import { rateLimit, clientIp, subjectOf } from "../quota.js";
import { storage } from "../storage.js";
import { createFileToken } from "../fileToken.js";
import { db } from "../firebase.js";
import { cleanId, cleanFilename, looksLikeImage, looksLikePdf } from "../uploadInput.js";
import { tierFor, ANONYMOUS_TIER, ANONYMOUS_DAILY_LIMIT, formatLimit, type TierLimits } from "../tiers.js";

/**
 * Chunked upload: how a file bigger than Vercel's body cap gets in.
 *
 *   POST /api/pdf/upload  { action: "part",     uploadId, index, total, data }
 *   POST /api/pdf/upload  { action: "complete", uploadId, total, filename }
 *
 * ── The problem this solves ───────────────────────────────────────────────
 * Vercel refuses a request body over ~4.5 MB before our code runs, and base64
 * inflates a payload by a third. That put the real ceiling near 3.3 MB, which
 * is below any interesting PDF. It is a limit on the *pipe*, not on what the
 * function can process: the same function has 2 GB of memory and five minutes.
 * So the fix is to stop pushing whole files through the pipe, not to move the
 * processing somewhere else.
 *
 * Parts land in object storage as they arrive; `complete` stitches them, checks
 * the result really is a PDF, writes the assembled object and returns a signed
 * `ref:` the PDF handlers resolve directly (see pdfInput.resolveUploadRef).
 * Nothing here ever holds more than one part plus the finished file.
 *
 * ── Why the client picks the uploadId ─────────────────────────────────────
 * A server-issued id would need a `begin` round trip before the first byte
 * moves. Keys are namespaced by caller, so one caller cannot address another's
 * parts, and an id they collide with themselves is their own upload to break.
 *
 * ── Why anonymous callers are allowed ─────────────────────────────────────
 * This path also serves the browser fallback, which fires precisely when a
 * visitor's own device could not do the job. Demanding a sign-up at that
 * moment is the worst possible time to ask. Anonymous use is bounded by IP
 * rate limit and a daily cap instead — a speed bump, and deliberately not
 * presented as more than that.
 */

/** Raw bytes per part. Base64 lifts 3 MB to 4 MB, leaving room under the cap. */
export const CHUNK_BYTES = 3 * 1024 * 1024;

/** Parts live only long enough to be stitched. */
const PART_TTL_SECONDS = 3600;

type Action = "part" | "complete";

interface Body {
  action?: Action;
  uploadId?: string;
  index?: number;
  total?: number;
  data?: string;
  filename?: string;
}

/** Keys are grouped per caller so no upload can address another's parts. */
function scopeOf(caller: Caller | null, ip: string): string {
  if (caller) return `u_${caller.uid}`;
  // Hashed so a raw IP is never written into a storage path.
  return `a_${createHash("sha256").update(ip).digest("hex").slice(0, 16)}`;
}

const partKey = (scope: string, uploadId: string, index: number) =>
  `_parts/${scope}/${uploadId}/${String(index).padStart(4, "0")}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");

  const provider = storage();
  if (!provider.persists || !provider.download) {
    return fail(res, 503, "STORAGE_UNAVAILABLE",
      "Chunked upload needs object storage, which is not configured on this deployment.");
  }

  /*
   * Authentication is optional here, unlike every other PDF route. An absent
   * Authorization header means "anonymous", not "unauthenticated" — but a
   * header that IS present must still be valid, so a broken token never
   * silently downgrades a signed-in user to the anonymous limits.
   */
  let caller: Caller | null = null;
  if (req.headers.authorization) {
    caller = await requireUser(req, res);
    if (!caller) return; // requireUser already answered
  }

  const ip = clientIp(req);
  const subject = caller ? subjectOf(caller) : `ip:${ip}`;
  const tier: TierLimits = caller ? await tierFor(caller.uid, Number.MAX_SAFE_INTEGER) : ANONYMOUS_TIER;

  const perMinute = rateLimit(`up:${subject}`, tier.ratePerMin);
  if (!perMinute.ok) {
    res.setHeader("Retry-After", String(perMinute.retryAfter));
    return fail(res, 429, "LIMIT_EXCEEDED", "Too many upload requests. Try again shortly.");
  }
  if (!caller) {
    const daily = rateLimit(`upday:${ip}`, ANONYMOUS_DAILY_LIMIT, 24 * 3600 * 1000);
    if (!daily.ok) {
      res.setHeader("Retry-After", String(daily.retryAfter));
      return fail(res, 429, "LIMIT_EXCEEDED",
        "Daily limit for uploads without an account reached. Sign in to continue.");
    }
  }

  const body = (req.body ?? {}) as Body;
  const uploadId = cleanId(body.uploadId);
  if (!uploadId) {
    return fail(res, 400, "INVALID_INPUT", "uploadId must be 8-64 characters of A-Z, a-z, 0-9, _ or -.");
  }

  const total = Number(body.total);
  const maxParts = Math.ceil(tier.maxJobBytes / CHUNK_BYTES) + 1;
  if (!Number.isInteger(total) || total < 1 || total > maxParts) {
    return fail(res, 400, "INVALID_INPUT",
      `total must be between 1 and ${maxParts} for the ${tier.label} tier (${formatLimit(tier.maxJobBytes)} per job).`);
  }

  const scope = scopeOf(caller, ip);

  /* ------------------------------------------------------------------ part */

  if (body.action === "part") {
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0 || index >= total) {
      return fail(res, 400, "INVALID_INPUT", `index must be between 0 and ${total - 1}.`);
    }
    if (typeof body.data !== "string" || !body.data) {
      return fail(res, 400, "INVALID_INPUT", "data must be a base64 string.");
    }

    const bytes = Buffer.from(body.data, "base64");
    if (bytes.length === 0) return fail(res, 400, "INVALID_INPUT", "data decoded to zero bytes.");
    if (bytes.length > CHUNK_BYTES + 1024) {
      return fail(res, 400, "INVALID_INPUT", `Each part must be at most ${CHUNK_BYTES / (1024 * 1024)} MB.`);
    }

    const key = partKey(scope, uploadId, index);
    const stored = await provider.upload(key, bytes, "application/octet-stream");
    if (!stored) {
      return fail(res, 503, "STORAGE_UNAVAILABLE", "Could not store that part. Retry it.");
    }

    /*
     * Indexed so the retention sweep can reach it.
     *
     * `complete` deletes the parts it consumed, but an upload that is abandoned
     * halfway never reaches `complete` — a dropped connection, a closed tab, a
     * caller that gives up. Without a row here those parts are invisible to the
     * sweep and stay in the bucket forever, which on a 10 GB free plan is a
     * slow leak that ends with uploads failing for everyone.
     */
    await db()
      .collection("storedFiles")
      .add({
        key,
        uid: caller ? caller.uid : null,
        size: bytes.length,
        expiresAt: new Date(Date.now() + PART_TTL_SECONDS * 1000).toISOString(),
        provider: provider.name,
        createdAt: new Date().toISOString(),
      })
      .catch((err) => console.error("[upload] could not index part:", (err as Error).name));

    return ok(res, { received: index, total });
  }

  /* -------------------------------------------------------------- complete */

  if (body.action === "complete") {
    const parts: Buffer[] = [];
    let assembled = 0;

    for (let i = 0; i < total; i++) {
      const chunk = await provider.download(partKey(scope, uploadId, i));
      if (!chunk) {
        return fail(res, 400, "INCOMPLETE_UPLOAD", `Part ${i} is missing. Upload it and complete again.`);
      }
      assembled += chunk.length;
      // Checked as we go: the declared part count bounds this, but a caller who
      // oversized every part should be stopped before the whole file is in RAM.
      if (assembled > tier.maxJobBytes) {
        return fail(res, 413, "LIMIT_EXCEEDED",
          `This job exceeds the ${formatLimit(tier.maxJobBytes)} limit on the ${tier.label} tier.`);
      }
      parts.push(Buffer.from(chunk));
    }

    const file = Buffer.concat(parts);
    parts.length = 0;

    /*
     * Type is checked here, at the only point where the whole file exists, so
     * an upload slot can never be used to park arbitrary bytes in our storage.
     * Images are allowed as well as PDFs because /api/pdf/convert/from-images
     * takes photos, and that operation needs the chunked path for exactly the
     * same reason the PDF ones do.
     */
    if (!looksLikePdf(file) && !looksLikeImage(file)) {
      void cleanupParts(provider, scope, uploadId, total);
      return fail(res, 400, "INVALID_INPUT", "upload: not a PDF or a supported image.");
    }

    const filename = cleanFilename(body.filename);
    const key = `${caller ? caller.uid : scope}/${new Date().toISOString().slice(0, 10)}/${randomBytes(4).toString("hex")}-${filename}`;

    const stored = await provider.upload(key, file, "application/pdf");
    if (!stored) {
      return fail(res, 503, "STORAGE_UNAVAILABLE", "Could not store the assembled file. Try again.");
    }

    // Parts have served their purpose. Not awaited: a failed cleanup is a
    // retention problem the sweep will pick up, not a reason to fail an upload
    // the caller has already paid for in bandwidth.
    void cleanupParts(provider, scope, uploadId, total);

    // Indexed so the retention sweep deletes it on time, exactly like generated
    // output. Uploads that are never used still expire.
    await db()
      .collection("storedFiles")
      .add({
        key,
        uid: caller ? caller.uid : null,
        size: file.length,
        expiresAt: new Date(Date.now() + PART_TTL_SECONDS * 1000).toISOString(),
        provider: provider.name,
        createdAt: new Date().toISOString(),
      })
      .catch((err) => console.error("[upload] could not index:", (err as Error).name));

    return ok(res, {
      ref: `ref:${createFileToken(key, PART_TTL_SECONDS)}`,
      size_bytes: file.length,
      filename,
      expires_at: new Date(Date.now() + PART_TTL_SECONDS * 1000).toISOString(),
    });
  }

  return fail(res, 400, "INVALID_INPUT", 'action must be "part" or "complete".');
}

async function cleanupParts(
  provider: ReturnType<typeof storage>,
  scope: string,
  uploadId: string,
  total: number,
): Promise<void> {
  for (let i = 0; i < total; i++) {
    await provider.delete(partKey(scope, uploadId, i)).catch(() => undefined);
  }
}
