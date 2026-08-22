import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "../http.js";
import { requireUser } from "../requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "../quota.js";
import { assertPublicHttpsUrl, assertLooksLikePdf, InputError, isUploadRef, resolveUploadRef } from "../pdfInput.js";
import { deliverParts } from "../storage.js";

/**
 * POST /api/split-pdf   { pdf: base64|https URL, ranges: "1-3,5,7-9" }
 *
 * Splits one source PDF into one output PDF per range group.
 *
 * Ported from the Supabase edge function; the limits are the same ones. The
 * SSRF guard and the magic-byte check now live in ../pdfInput.js, shared with
 * every other handler that accepts a PDF or an https URL (see O-10).
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB of PDF bytes per request
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 is ~33% overhead)
const MAX_SEGMENTS = 50; // max output files per request
// MAX_INPUTS (30) does not bite here: this endpoint takes exactly one PDF.

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

/* ---------------------------------------------------------------- ranges */

/**
 * "1-3,5,7-9" -> [[0,1,2],[4],[6,7,8]]. Out-of-bounds ends are clamped to the
 * document, out-of-bounds single pages are dropped, and an entirely unusable
 * string yields [] — which the caller turns into a 400.
 */
function parseRanges(input: string, total: number): number[][] {
  const groups: number[][] = [];
  input.split(",").forEach((raw) => {
    const p = raw.trim();
    if (!p) return;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1]));
      const b = Math.min(total, parseInt(m[2]));
      if (a <= b) groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
    } else {
      const n = parseInt(p);
      if (!isNaN(n) && n >= 1 && n <= total) groups.push([n - 1]);
    }
  });
  return groups;
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
    const { pdf, ranges } = (req.body ?? {}) as { pdf?: unknown; ranges?: unknown };
    if (!pdf) return fail(res, 400, "INVALID_INPUT", "'pdf' (base64 or URL) is required");
    if (!ranges || typeof ranges !== "string") {
      return fail(res, 400, "INVALID_INPUT", "'ranges' must be a string like '1-3,5,7-9'");
    }

    const bytes = await loadPdf(pdf, "pdf");
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();

    const groups = parseRanges(ranges, total);
    if (groups.length === 0) {
      return fail(res, 400, "INVALID_INPUT", "No valid ranges. Pages 1..N only.");
    }
    if (groups.length > MAX_SEGMENTS) {
      return fail(res, 400, "LIMIT_EXCEEDED", `Maximum ${MAX_SEGMENTS} output segments per request.`);
    }

    const pdfs: Array<{ name: string; bytes: Uint8Array; pages: number }> = [];
    let totalOut = 0;

    for (const group of groups) {
      const doc = await PDFDocument.create();
      const copied = await doc.copyPages(src, group);
      copied.forEach((p) => doc.addPage(p));
      const outBytes = await doc.save();

      totalOut += outBytes.length;
      // Checked inside the loop so a request that would blow the budget stops
      // early rather than after building fifty copies of a 20MB document.
      if (bytes.length + totalOut > MAX_TOTAL_BYTES) {
        return fail(
          res,
          413,
          "LIMIT_EXCEEDED",
          `Output exceeds the ${MAX_TOTAL_BYTES / (1024 * 1024)}MB per-request limit. Split into fewer segments.`,
        );
      }

      const label = group.length === 1
        ? `p${group[0] + 1}`
        : `p${group[0] + 1}-${group[group.length - 1] + 1}`;

      pdfs.push({
        name: `split_${label}.pdf`,
        bytes: outBytes,
        pages: group.length,
      });
    }

    await recordUsage(caller.uid, {
      pdfs: pdfs.length,
      apiCalls: 1,
      bytes: bytes.length + totalOut,
    });

    // Inline while the whole set fits the response cap, signed links past it.
    const delivered = await deliverParts(caller.uid, pdfs);

    return ok(res, {
      success: true,
      source_pages: total,
      pdfs: delivered.map((d, i) => ({ ...d, pages: pdfs[i].pages })),
      processing_time_ms: Date.now() - start,
    });
  } catch (err) {
    if (err instanceof InputError) {
      return fail(res, 400, "INVALID_INPUT", err.message);
    }
    // Error names only — messages from pdf-lib can quote document contents.
    console.error("[api/split-pdf] failed:", (err as Error).name);
    return fail(res, 500, "SPLIT_FAILED", "Could not split that PDF. It may be corrupt or password-protected.");
  }
}
