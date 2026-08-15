import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as dns } from "node:dns";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "../http.js";
import { requireUser } from "../requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "../quota.js";

/**
 * PDF to images.
 *
 * Server side this splits the document into one single-page PDF per page and
 * returns them base64-encoded. It does NOT rasterise to PNG/JPEG: rasterising a
 * page means drawing it, which needs a canvas, and there is no canvas in the
 * Node serverless runtime. The browser tool at /pdf-to-images does that with
 * pdf.js and a real <canvas>; asking for a raster format here gets an honest
 * 501 rather than a silently different result.
 *
 * A page-per-file split is what most downstream pipelines (thumbnailing,
 * per-page OCR) actually want as input anyway.
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB of PDF bytes per request
const MAX_INPUTS = 30; // max PDF inputs per request
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 overhead)
const MAX_PAGES = 100; // endpoint-specific: pages per request

const RASTER_FORMATS = new Set(["png", "jpg", "jpeg", "webp", "image"]);

/** %PDF magic bytes. Some producers emit whitespace/BOM first, so scan a bit. */
function assertLooksLikePdf(bytes: Uint8Array, label = "pdf") {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return;
  }
  throw new Error(`${label}: not a valid PDF file`);
}

/* ------------------------------------------------------------------ SSRF guard
 * Require https, forbid URL credentials and redirects, and block private,
 * loopback, link-local and metadata targets — by hostname AND by the address
 * the hostname resolves to, which is the only thing that stops DNS rebinding.
 */

function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipToLong(ip);
  if (n === null) return true; // unparseable means "do not trust it"
  const inRange = (start: string, prefix: number) => {
    const s = ipToLong(start)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (n & mask) === (s & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) || // link-local, incl. AWS/GCP metadata 169.254.169.254
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("192.0.0.0", 24) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 4) ||
    inRange("240.0.0.0", 4)
  );
}

function isBlockedIPv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
  if (s.startsWith("fe80:")) return true; // link-local
  if (s.startsWith("::ffff:")) return isBlockedIPv4(s.slice(7)); // v4-mapped
  return false;
}

async function assertPublicHttpsUrl(raw: string, label: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${label}: invalid URL`);
  }
  if (u.protocol !== "https:") throw new Error(`${label}: only https URLs are allowed`);
  if (u.username || u.password) throw new Error(`${label}: URL credentials are not allowed`);

  const host = u.hostname.replace(/^\[|\]$/g, "");
  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower === "metadata.google.internal"
  ) {
    throw new Error(`${label}: host is not allowed`);
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIPv4(host)) throw new Error(`${label}: private/internal IP is not allowed`);
    return;
  }
  if (host.includes(":")) {
    if (isBlockedIPv6(host)) throw new Error(`${label}: private/internal IP is not allowed`);
    return;
  }

  try {
    const records = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    const ips: string[] = [];
    for (const r of records) if (r.status === "fulfilled") ips.push(...r.value);
    if (ips.length === 0) throw new Error(`${label}: could not resolve host`);
    for (const ip of ips) {
      if (ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip)) {
        throw new Error(`${label}: host resolves to a private/internal address`);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(`${label}:`)) throw e;
    throw new Error(`${label}: DNS resolution failed`);
  }
}

/** Load a PDF from base64 (data URI or raw) or an https URL. */
async function loadPdf(input: unknown, label = "pdf"): Promise<Uint8Array> {
  if (typeof input !== "string" || !input) {
    throw new Error(`${label}: must be a base64 string or https URL`);
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
    // Following a redirect would re-open every hole the checks above closed,
    // since the new target never goes through them.
    if (res.status >= 300 && res.status < 400) throw new Error(`${label}: redirects are not allowed`);
    if (!res.ok) throw new Error(`${label}: fetch failed (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
    assertLooksLikePdf(buf, label);
    return buf;
  }

  const b64 = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    throw new Error(`${label}: invalid base64 payload`);
  }
  if (bytes.length === 0) throw new Error(`${label}: invalid base64 payload`);
  if (bytes.length > MAX_PDF_BYTES) throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
  assertLooksLikePdf(bytes, label);
  return bytes;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST");

  const started = Date.now();

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

  try {
    const body = (req.body ?? {}) as { pdf?: unknown; format?: unknown };

    if (Array.isArray(body.pdf)) {
      // Kept explicit rather than silently taking the first element: the shared
      // input cap exists, and a caller sending an array meant something else.
      return fail(res, 400, "INVALID_INPUT", `'pdf' must be a single PDF (max ${MAX_INPUTS} inputs elsewhere in the API).`);
    }
    if (!body.pdf) {
      return fail(res, 400, "INVALID_INPUT", "'pdf' (base64 or URL) is required");
    }

    const format = String(body.format ?? "pdf").toLowerCase();
    if (RASTER_FORMATS.has(format)) {
      return fail(
        res,
        501,
        "NOT_IMPLEMENTED",
        "Raster output (PNG/JPEG) is not available from the API: rendering a PDF page requires a canvas, " +
          "which this serverless runtime does not have. Omit 'format' to receive one single-page PDF per page, " +
          "or use the browser tool at /pdf-to-images, which renders with pdf.js and a real canvas.",
      );
    }
    if (format !== "pdf") {
      return fail(res, 400, "INVALID_INPUT", "'format' must be 'pdf'.");
    }

    const bytes = await loadPdf(body.pdf, "pdf");
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();
    if (total > MAX_PAGES) {
      return fail(res, 400, "LIMIT_EXCEEDED", `Max ${MAX_PAGES} pages per request.`);
    }

    const pages: Array<{ page: number; filename: string; size_bytes: number; data: string }> = [];
    let producedBytes = 0;

    for (let i = 0; i < total; i++) {
      const one = await PDFDocument.create();
      const [copied] = await one.copyPages(src, [i]);
      one.addPage(copied);
      const out = Buffer.from(await one.save());

      // Each page carries the source document's shared resources, so a fat PDF
      // can inflate on split. Stop at the cap instead of building a response
      // too big to serialise.
      producedBytes += out.length;
      if (producedBytes > MAX_TOTAL_BYTES) {
        return fail(
          res,
          400,
          "LIMIT_EXCEEDED",
          `Split output exceeds the ${MAX_TOTAL_BYTES / (1024 * 1024)}MB total limit. Split a smaller range of pages.`,
        );
      }

      // TODO(stage-3): switch to StorageProvider + temporary link
      pages.push({
        page: i + 1,
        filename: `page_${i + 1}.pdf`,
        size_bytes: out.length,
        data: out.toString("base64"),
      });
    }

    await recordUsage(caller.uid, { pdfs: total, apiCalls: 1, bytes: bytes.length + producedBytes });

    return ok(res, {
      success: true,
      output_format: "pdf-per-page",
      note: "Each page is returned as a base64 single-page PDF. For raster PNG/JPEG output, use the browser tool at /pdf-to-images.",
      page_count: total,
      pages,
      processing_time_ms: Date.now() - started,
    });
  } catch (err) {
    // Input-shaped failures carry a message written for the caller and no
    // document contents, so they are safe to return. Anything else is ours.
    const e = err as Error;
    console.error("[api/pdf-to-images] failed:", e.name);
    if (e.message?.startsWith("pdf:")) {
      return fail(res, 400, "INVALID_INPUT", e.message);
    }
    return fail(res, 500, "CONVERT_FAILED", "Could not split that PDF. It may be corrupt or password-protected.");
  }
}
