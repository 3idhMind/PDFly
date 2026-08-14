import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as dns } from "node:dns";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "./_lib/http.js";
import { requireUser } from "./_lib/requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "./_lib/quota.js";

/* ------------------------------------------------------------------- limits */

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB of input across the request
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 is ~33% larger)
const MAX_MERGE_INPUTS = 20; // endpoint-specific; the platform-wide cap is 30

/* ------------------------------------------------------------ PDF sniffing */

/**
 * %PDF magic bytes. Checked on every input, including ones fetched from a URL:
 * without it any byte stream a caller can point us at gets handed to the parser.
 * Searched over the first KB rather than at offset 0 because some producers emit
 * leading whitespace or a BOM.
 */
function assertLooksLikePdf(bytes: Uint8Array, label: string) {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return;
  }
  throw new Error(`${label}: not a valid PDF file`);
}

/* -------------------------------------------------------------- SSRF guard */

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
  if (n === null) return true; // unparseable — refuse rather than guess
  const inRange = (start: string, prefix: number) => {
    const s = ipToLong(start)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (n & mask) === (s & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) || // link-local, incl. the 169.254.169.254 metadata address
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
 * https only, no URL credentials, no private targets — checked both by hostname
 * and by every address the hostname resolves to. The DNS pass is the part that
 * matters: a public name can resolve to 169.254.169.254 and hand the caller the
 * platform's instance metadata. Redirects are refused at the fetch below, since
 * a followed redirect would land somewhere this function never inspected.
 */
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

/* ------------------------------------------------------------- input loader */

/** Accepts a base64 string (with or without a data: prefix) or an https URL. */
async function loadPdf(input: unknown, label: string): Promise<Uint8Array> {
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

    // TODO(stage-3): switch to StorageProvider + temporary link
    // The Supabase version uploaded to storage and returned a signed URL that
    // expired in an hour. Object storage is not in place yet, so the bytes come
    // back inline — same as /api/pdf-fallback. Callers get the file either way.
    return ok(res, {
      success: true,
      filename: "merged.pdf",
      content_type: "application/pdf",
      pdf_base64: Buffer.from(out).toString("base64"),
      size_bytes: out.length,
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
