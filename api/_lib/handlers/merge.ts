import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "../http.js";
import { requireUser } from "../requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "../quota.js";
import { assertPublicHttpsUrl, assertLooksLikePdf, isUploadRef, resolveUploadRef } from "../pdfInput.js";
import { deliverFile } from "../storage.js";

/* ------------------------------------------------------------------- limits */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB of input across the request
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 is ~33% larger)
const MAX_MERGE_INPUTS = 20; // endpoint-specific; the platform-wide cap is 30

/* ------------------------------------------------------------- input loader */

/** Accepts base64 (with or without a data: prefix), an https URL, or a `ref:`. */
async function loadPdf(input: unknown, label: string): Promise<Uint8Array> {
  if (typeof input !== "string" || !input) {
    throw new Error(`${label}: must be a base64 string, https URL or upload ref`);
  }

  // A ref from /api/pdf/upload: bytes already in storage, no size cap to clear
  // because they never travelled through a request body.
  if (isUploadRef(input)) {
    const bytes = await resolveUploadRef(input, label);
    assertLooksLikePdf(bytes, label);
    return bytes;
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    await assertPublicHttpsUrl(input, label);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(input, { redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (res.status >= 300 && res.status < 400) throw new Error(`${label}: redirects are not allowed`);
    if (!res.ok) throw new Error(`${label}: fetch failed (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
    assertLooksLikePdf(buf, label);
    return buf;
  }

  const b64 = input.includes(",") ? input.split(",")[1] : input;
  // Size-check the encoded string first, so an oversized input is rejected
  // before it is expanded into memory rather than after.
  if ((b64.length * 3) / 4 > MAX_PDF_BYTES) {
    throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
  }
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.length === 0) throw new Error(`${label}: invalid base64 payload`);
  if (bytes.length > MAX_PDF_BYTES) throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
  // Buffer.from silently drops characters it cannot decode, so garbage in is
  // garbage out rather than a throw — the magic-byte check is what catches it.
  assertLooksLikePdf(bytes, label);
  return bytes;
}

/* ---------------------------------------------------------------- handler */

/**
 * POST /api/merge-pdf   { pdfs: [base64 | https URL, …] }
 *
 * Concatenates 2–20 PDFs in the order given and returns the result.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");

  // Cheap rejection from the header, before the body is touched at all.
  const declaredLength = Number(req.headers["content-length"] ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return fail(
      res,
      413,
      "PAYLOAD_TOO_LARGE",
      `Request body exceeds ${Math.round(MAX_BODY_BYTES / (1024 * 1024))}MB.`,
    );
  }

  const caller = await requireUser(req, res);
  if (!caller) return;

  const rl = rateLimit(subjectOf(caller), caller.rateLimitPerMin);
  if (!rl.ok) {
    return fail(res, 429, "RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.retryAfter}s.`, {
      retry_after_seconds: rl.retryAfter,
    });
  }

  const quota = await checkQuota(caller.uid);
  if (!quota.allowed) {
    return fail(res, 402, "QUOTA_EXCEEDED", `Monthly free-tier limit of ${quota.limit} PDFs reached.`, {
      used: quota.used,
      limit: quota.limit,
    });
  }

  const start = Date.now();

  try {
    const pdfs = req.body?.pdfs;
    if (!Array.isArray(pdfs) || pdfs.length < 2) {
      return fail(
        res,
        400,
        "INVALID_INPUT",
        "'pdfs' must be an array of at least 2 items (base64 or https URLs)",
      );
    }
    if (pdfs.length > MAX_MERGE_INPUTS) {
      return fail(res, 400, "LIMIT_EXCEEDED", `Maximum ${MAX_MERGE_INPUTS} PDFs per merge request.`);
    }

    const merged = await PDFDocument.create();
    let totalIn = 0;

    // Loaded one at a time, with the running total checked as we go: fetching
    // all 20 first would mean holding up to 400MB before noticing the breach.
    for (let i = 0; i < pdfs.length; i++) {
      const bytes = await loadPdf(pdfs[i], `pdfs[${i}]`);
      totalIn += bytes.length;
      if (totalIn > MAX_TOTAL_BYTES) {
        return fail(
          res,
          413,
          "LIMIT_EXCEEDED",
          `Combined input exceeds ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))}MB.`,
        );
      }
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await merged.copyPages(src, src.getPageIndices());
      copied.forEach((p) => merged.addPage(p));
    }

    const out = await merged.save();
    const ms = Date.now() - start;

    await recordUsage(caller.uid, { pdfs: 1, apiCalls: 1, bytes: totalIn });

    // Inline when it fits, a signed link when it does not. See deliverFile.
    const delivery = await deliverFile(caller.uid, "merged.pdf", out);

    return ok(res, {
      success: true,
      filename: "merged.pdf",
      content_type: "application/pdf",
      ...delivery,
      pages_merged: merged.getPageCount(),
      inputs: pdfs.length,
      processing_time_ms: ms,
    });
  } catch (err) {
    // Never log the error body: input errors carry file contents and URLs.
    console.error("[api/merge-pdf] failed:", (err as Error).name);
    // The message is caller-facing on purpose — "pdfs[3]: not a valid PDF file"
    // is the whole diagnostic. Every throw above is written with that in mind
    // and none of them contain document content.
    return fail(res, 500, "MERGE_FAILED", (err as Error).message);
  }
}
