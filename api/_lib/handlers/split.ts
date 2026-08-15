import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as dns } from "node:dns";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "../http.js";
import { requireUser } from "../requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "../quota.js";

/**
 * POST /api/split-pdf   { pdf: base64|https URL, ranges: "1-3,5,7-9" }
 *
 * Splits one source PDF into one output PDF per range group.
 *
 * Ported from the Supabase edge function. The limits, the SSRF guard and the
 * magic-byte check are the same ones; they are inlined here because the shared
 * Deno module used `Deno.resolveDns` and the Supabase client, neither of which
 * exists on Node.
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB of PDF bytes per request
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 is ~33% overhead)
const MAX_SEGMENTS = 50; // max output files per request
// MAX_INPUTS (30) does not bite here: this endpoint takes exactly one PDF.

const FETCH_TIMEOUT_MS = 15_000;

/** Thrown for anything the caller can fix. Its message is safe to return. */
class InputError extends Error {}

/* ------------------------------------------------------------ SSRF guard */

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
    inRange("169.254.0.0", 16) || // link-local + AWS/GCP metadata 169.254.169.254
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

/**
 * https only, no URL credentials, no internal hostnames, and — the part that is
 * easy to forget — no hostname that *resolves* to a private address. Without the
 * DNS check a public name pointed at 169.254.169.254 walks straight into the
 * metadata service.
 */
async function assertPublicHttpsUrl(raw: string, label: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new InputError(`${label}: invalid URL`);
  }
  if (u.protocol !== "https:") throw new InputError(`${label}: only https URLs are allowed`);
  if (u.username || u.password) throw new InputError(`${label}: URL credentials are not allowed`);

  const host = u.hostname.replace(/^\[|\]$/g, "");
  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower === "metadata.google.internal"
  ) {
    throw new InputError(`${label}: host is not allowed`);
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIPv4(host)) throw new InputError(`${label}: private/internal IP is not allowed`);
    return;
  }
  if (host.includes(":")) {
    if (isBlockedIPv6(host)) throw new InputError(`${label}: private/internal IP is not allowed`);
    return;
  }

  try {
    const records = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    const ips: string[] = [];
    for (const r of records) if (r.status === "fulfilled") ips.push(...r.value);
    if (ips.length === 0) throw new InputError(`${label}: could not resolve host`);
    for (const ip of ips) {
      if (ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip)) {
        throw new InputError(`${label}: host resolves to a private/internal address`);
      }
    }
  } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError(`${label}: DNS resolution failed`);
  }
}

/* --------------------------------------------------------------- loading */

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

function assertLooksLikePdf(bytes: Uint8Array, label = "pdf") {
  // Some producers emit leading whitespace/BOM before %PDF-, so scan the head
  // rather than testing offset 0.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (
      head[i] === PDF_MAGIC[0] && head[i + 1] === PDF_MAGIC[1] &&
      head[i + 2] === PDF_MAGIC[2] && head[i + 3] === PDF_MAGIC[3]
    ) return;
  }
  throw new InputError(`${label}: not a valid PDF file`);
}

/** Accepts base64 (with or without a data: prefix) or a public https URL. */
async function loadPdf(input: unknown, label = "pdf"): Promise<Uint8Array> {
  if (typeof input !== "string" || !input) {
    throw new InputError(`${label}: must be a base64 string or https URL`);
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

    const pdfs: Array<{ name: string; data: string; size_bytes: number; pages: number }> = [];
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

      // TODO(stage-3): switch to StorageProvider + temporary link
      // Supabase Storage is gone and its replacement is not built yet, so the
      // bytes ride back in the response. Callers get the file immediately; the
      // trade-off is the 50MB cap above and no `expires_in_seconds` to report.
      pdfs.push({
        name: `split_${label}.pdf`,
        data: Buffer.from(outBytes).toString("base64"),
        size_bytes: outBytes.length,
        pages: group.length,
      });
    }

    await recordUsage(caller.uid, {
      pdfs: pdfs.length,
      apiCalls: 1,
      bytes: bytes.length + totalOut,
    });

    return ok(res, {
      success: true,
      source_pages: total,
      pdfs,
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
