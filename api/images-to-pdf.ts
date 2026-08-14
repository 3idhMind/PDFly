import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as dns } from "node:dns";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "./_lib/http.js";
import { requireUser } from "./_lib/requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "./_lib/quota.js";

/**
 * POST /api/images-to-pdf
 *
 * Body: {
 *   images: [{ data: "<base64 | data URI | https URL>", name?, type? }, ...],
 *   page_size?: "A4" | "Letter" | "Legal" | "A3" | "A5" | "Tabloid",
 *   orientation?: "portrait" | "landscape",
 *   fit_mode?: "fit" | "fill" | "original"
 * }
 *
 * The Supabase version only validated the payload and told the caller to use the
 * web UI. It now actually assembles the PDF, because pdf-lib's embedJpg/embedPng
 * need no native dependencies — unlike the raster paths elsewhere in this API.
 */

const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB per image (MAX_PDF_BYTES)
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB across the whole request
const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap, base64 overhead included
const MAX_IMAGES = 20; // endpoint-specific, stricter than the shared MAX_INPUTS of 30
const FETCH_TIMEOUT_MS = 15_000;

/** Points at 72dpi, portrait. */
const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  Tabloid: [792, 1224],
};

/* ------------------------------------------------------------------ SSRF guard */
// Carried over verbatim in behaviour from supabase/functions/_shared/pdf-api.ts:
// https only, no URL credentials, no redirects, blocked hostnames, and blocked
// IPv4/IPv6 ranges checked against the *resolved* addresses so a public-looking
// name cannot be rebound to something internal.

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
  if (n === null) return true; // unparseable means blocked, never "probably fine"
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

/* ---------------------------------------------------------------- image input */

/**
 * Magic-byte check, the images-to-pdf counterpart of assertLooksLikePdf.
 * Content-Type headers and file names are caller-controlled, so the format we
 * hand to pdf-lib is decided by the bytes and nothing else.
 */
function sniffImage(bytes: Uint8Array, label: string): "png" | "jpg" {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  throw new Error(`${label}: not a PNG or JPEG image`);
}

async function loadImage(input: unknown, label: string): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" }> {
  if (typeof input !== "string" || !input) {
    throw new Error(`${label}: must be a base64 string or https URL`);
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    await assertPublicHttpsUrl(input, label);
    const res = await fetch(input, {
      redirect: "manual", // a redirect would escape the guard above
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) throw new Error(`${label}: redirects are not allowed`);
    if (!res.ok) throw new Error(`${label}: fetch failed (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_INPUT_BYTES) {
      throw new Error(`${label}: exceeds ${MAX_INPUT_BYTES / (1024 * 1024)}MB limit`);
    }
    return { bytes, kind: sniffImage(bytes, label) };
  }

  const b64 = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  // Reject on the encoded length first: base64 is ~4/3 of the payload, so this
  // rejects an oversized image without allocating the decoded copy.
  if (b64.length * 0.75 > MAX_INPUT_BYTES) {
    throw new Error(`${label}: exceeds ${MAX_INPUT_BYTES / (1024 * 1024)}MB limit`);
  }
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.length === 0) throw new Error(`${label}: invalid base64 payload`);
  if (bytes.length > MAX_INPUT_BYTES) {
    throw new Error(`${label}: exceeds ${MAX_INPUT_BYTES / (1024 * 1024)}MB limit`);
  }
  return { bytes, kind: sniffImage(bytes, label) };
}

/* ------------------------------------------------------------------- assembly */

/** Page box plus where the image sits on it, in points. */
function layout(
  imgW: number,
  imgH: number,
  fitMode: string,
  pageSize: string,
  orientation: string,
) {
  if (fitMode === "original") {
    // Page takes the image's own dimensions — nothing to scale or centre.
    return { page: [imgW, imgH] as [number, number], x: 0, y: 0, w: imgW, h: imgH };
  }

  const [pw, ph] = PAGE_SIZES[pageSize];
  const page: [number, number] = orientation === "landscape" ? [ph, pw] : [pw, ph];
  // "fill" covers the page and lets the overflow fall outside the MediaBox,
  // which is how a PDF viewer crops it; "fit" keeps the whole image visible.
  const scale =
    fitMode === "fill"
      ? Math.max(page[0] / imgW, page[1] / imgH)
      : Math.min(page[0] / imgW, page[1] / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { page, x: (page[0] - w) / 2, y: (page[1] - h) / 2, w, h };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST method.");

  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
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

  const started = Date.now();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const images = body.images;
  const pageSize = String(body.page_size ?? "A4");
  const orientation = String(body.orientation ?? "portrait");
  const fitMode = String(body.fit_mode ?? "fit");

  if (!Array.isArray(images) || images.length === 0) {
    return fail(res, 400, "INVALID_INPUT", "Missing 'images' array. Provide base64-encoded images.");
  }
  if (images.length > MAX_IMAGES) {
    return fail(
      res,
      400,
      "LIMIT_EXCEEDED",
      `Maximum ${MAX_IMAGES} images per API request. You sent ${images.length}. For 100+ images, use the web UI at /images-to-pdf.`,
    );
  }
  if (!(pageSize in PAGE_SIZES)) {
    return fail(res, 400, "INVALID_INPUT", `Invalid page_size. Use one of: ${Object.keys(PAGE_SIZES).join(", ")}`);
  }
  if (!["portrait", "landscape"].includes(orientation)) {
    return fail(res, 400, "INVALID_INPUT", "Invalid orientation. Use 'portrait' or 'landscape'.");
  }
  if (!["fit", "fill", "original"].includes(fitMode)) {
    return fail(res, 400, "INVALID_INPUT", "Invalid fit_mode. Use 'fit', 'fill', or 'original'.");
  }

  try {
    const doc = await PDFDocument.create();
    let totalIn = 0;

    for (let i = 0; i < images.length; i++) {
      const entry = images[i] as { data?: unknown } | string;
      const data = typeof entry === "string" ? entry : entry?.data;
      if (typeof data !== "string" || !data) {
        return fail(res, 400, "INVALID_INPUT", `Image at index ${i} missing 'data' field (base64 string or https URL required).`);
      }

      let loaded: { bytes: Uint8Array; kind: "png" | "jpg" };
      try {
        loaded = await loadImage(data, `images[${i}]`);
      } catch (err) {
        // These messages are about the caller's own input, so they are safe to
        // return and are the only useful thing we can say.
        return fail(res, 400, "INVALID_INPUT", (err as Error).message);
      }

      totalIn += loaded.bytes.length;
      if (totalIn > MAX_TOTAL_BYTES) {
        return fail(res, 413, "LIMIT_EXCEEDED", `Combined input exceeds ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))}MB.`);
      }

      const img = loaded.kind === "png" ? await doc.embedPng(loaded.bytes) : await doc.embedJpg(loaded.bytes);
      const box = layout(img.width, img.height, fitMode, pageSize, orientation);
      const page = doc.addPage(box.page);
      page.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h });
    }

    const out = await doc.save();
    await recordUsage(caller.uid, { pdfs: 1, apiCalls: 1, bytes: totalIn });

    // TODO(stage-3): switch to StorageProvider + temporary link
    return ok(res, {
      success: true,
      filename: "images.pdf",
      pdf_base64: Buffer.from(out).toString("base64"),
      size_bytes: out.length,
      pages: doc.getPageCount(),
      images: images.length,
      page_size: fitMode === "original" ? "original" : pageSize,
      orientation,
      fit_mode: fitMode,
      processing_time_ms: Date.now() - started,
    });
  } catch (err) {
    // Names only: the message can carry fragments of the caller's file.
    console.error("[api/images-to-pdf] failed:", (err as Error).name);
    return fail(res, 500, "PROCESSING_FAILED", "Could not build a PDF from those images.");
  }
}
