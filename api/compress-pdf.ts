import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as dns } from "node:dns";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "./_lib/http";
import { requireUser } from "./_lib/requireUser";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "./_lib/quota";

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
 * Ported from the Supabase edge function. The limits, the SSRF guard and the
 * magic-byte check are the same ones; they are inlined here because the shared
 * Deno module used `Deno.resolveDns` and the Supabase client, neither of which
 * exists on Node.
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 is ~33% overhead)
// MAX_TOTAL_BYTES (50 MB) and MAX_INPUTS (30) from the shared Deno helpers only
// bite on the multi-input endpoints. This one takes exactly one PDF and only
// ever shrinks it, so the 20 MB per-input cap is the binding limit.

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

    // TODO(stage-3): switch to StorageProvider + temporary link
    // Supabase Storage is gone and its replacement is not built yet, so the
    // bytes ride back in the response instead of a signed `url`. Callers get the
    // file immediately; the trade-off is no `expires_in_seconds` to report.
    return ok(res, {
      success: true,
      name: "compressed.pdf",
      data: Buffer.from(out).toString("base64"),
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
