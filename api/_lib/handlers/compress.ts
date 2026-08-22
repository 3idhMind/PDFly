import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "../http.js";
import { requireUser } from "../requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "../quota.js";
import { assertPublicHttpsUrl, assertLooksLikePdf, InputError, isUploadRef, resolveUploadRef } from "../pdfInput.js";
import { deliverFile } from "../storage.js";

/**
 * POST /api/compress-pdf   { pdf: base64|https URL, target_bytes?: number }
 *
 * Server-side compression is the *lossless structure pass* only: metadata is
 * stripped and the document is rewritten with object streams. That reclaims the
 * xref table, unused objects and producer metadata — typically 5–40% depending
 * on the source — without touching a single pixel.
 *
 * The deep (raster) path, which re-encodes embedded images, is browser-only:
 * it needs a `<canvas>` to rasterise pages, and there is no canvas here. Rather
 * than quietly under-delivering, the response carries `notes: { mode,
 * target_bytes, target_met }` so a caller who asked for a specific size can see
 * whether it was actually reached. Same honesty as /api/pdf-fallback.
 *
 * Ported from the Supabase edge function; the limits are the same ones. The
 * SSRF guard and the magic-byte check now live in ../pdfInput.js, shared with
 * every other handler that accepts a PDF or an https URL (see O-10).
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 is ~33% overhead)
// MAX_TOTAL_BYTES (50 MB) and MAX_INPUTS (30) from the shared Deno helpers only
// bite on the multi-input endpoints. This one takes exactly one PDF and only
// ever shrinks it, so the 20 MB per-input cap is the binding limit.

const FETCH_TIMEOUT_MS = 15_000;

/* --------------------------------------------------------------- loading */

/** Accepts base64 (with or without a data: prefix) or a public https URL. */
async function loadPdf(input: unknown, label = "pdf"): Promise<Uint8Array> {
  if (typeof input !== "string" || !input) {
    throw new InputError(`${label}: must be a base64 string, https URL or upload ref`);
  }

  // A ref from /api/pdf/upload: bytes already in storage, so no request-body
  // size cap applies — the tier ceiling was enforced when they were uploaded.
  if (isUploadRef(input)) {
    const bytes = await resolveUploadRef(input, label);
    assertLooksLikePdf(bytes, label);
    return bytes;
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    await assertPublicHttpsUrl(input, label);
    let res: Response;
    try {
      // redirect:"manual" — a 302 to an internal address would otherwise bypass
      // every check above, since only the first URL was ever validated.
      res = await fetch(input, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      throw new InputError(`${label}: fetch failed`);
    }
    if (res.status >= 300 && res.status < 400) throw new InputError(`${label}: redirects are not allowed`);
    if (!res.ok) throw new InputError(`${label}: fetch failed (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) {
      throw new InputError(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
    }
    assertLooksLikePdf(buf, label);
    return buf;
  }

  const b64 = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  // Buffer.from is lenient about junk characters, so garbage decodes to garbage
  // rather than throwing — the magic-byte check below is what actually rejects it.
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.length === 0) throw new InputError(`${label}: invalid base64 payload`);
  if (bytes.length > MAX_PDF_BYTES) {
    throw new InputError(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
  }
  assertLooksLikePdf(bytes, label);
  return bytes;
}

/* --------------------------------------------------------------- handler */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");

  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return fail(res, 413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${Math.round(MAX_BODY_BYTES / (1024 * 1024))}MB.`);
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pdf = body.pdf;
    if (!pdf) return fail(res, 400, "INVALID_INPUT", "'pdf' (base64 or URL) is required");

    // Snake case matches the rest of this API; camel case is what the browser
    // fallback client already sends. Accept both rather than make callers guess.
    const target = Number(body.target_bytes ?? body.targetBytes ?? 0);
    if (!Number.isFinite(target) || target < 0) {
      return fail(res, 400, "INVALID_INPUT", "'target_bytes' must be a positive number of bytes");
    }

    const bytes = await loadPdf(pdf, "pdf");

    // updateMetadata:false stops pdf-lib writing its own ModDate back in after
    // we have just cleared the metadata.
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("PDFly");
    doc.setCreator("PDFly");
    const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });

    await recordUsage(caller.uid, { pdfs: 1, apiCalls: 1, bytes: bytes.length + out.length });

    const ratio = bytes.length > 0 ? out.length / bytes.length : 1;

    // Inline when it fits, a signed link when it does not. `data` is kept as
    // the field name existing callers already read.
    const delivery = await deliverFile(caller.uid, "compressed.pdf", out);

    return ok(res, {
      success: true,
      name: "compressed.pdf",
      ...(delivery.pdf_base64 ? { data: delivery.pdf_base64 } : {}),
      ...(delivery.download_url ? { download_url: delivery.download_url } : {}),
      original_size_bytes: bytes.length,
      compressed_size_bytes: out.length,
      compression_ratio: Number(ratio.toFixed(3)),
      savings_percent: Number(((1 - ratio) * 100).toFixed(1)),
      notes: {
        mode: "lossless",
        target_bytes: target || null,
        // null, not false, when no target was asked for — "not requested" and
        // "requested and missed" are different answers.
        target_met: target ? out.length <= target : null,
      },
      processing_time_ms: Date.now() - start,
    });
  } catch (err) {
    if (err instanceof InputError) {
      return fail(res, 400, "INVALID_INPUT", err.message);
    }
    // Error names only — messages from pdf-lib can quote document contents.
    console.error("[api/compress-pdf] failed:", (err as Error).name);
    return fail(res, 500, "COMPRESS_FAILED", "Could not compress that PDF. It may be corrupt or password-protected.");
  }
}
