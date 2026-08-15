import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument } from "pdf-lib";
import { fail, ok, handledPreflight } from "../http.js";
import { rateLimit } from "../quota.js";

/**
 * Public, anonymous, zero-retention PDF fallback for the web UI.
 *
 * Used only when a visitor's device cannot handle the job locally and they
 * explicitly opted in. Everything happens in memory: no auth, no quota, no
 * storage writes, no database rows, no logging of file contents. Results are
 * returned in the same response and then discarded.
 *
 * Deliberately NOT behind requireUser — the whole point is that a visitor with
 * a weak device gets the job done without an account. The per-IP throttle plus
 * the size caps are what keep that from being an open compute faucet.
 */

const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 40;
const MAX_SPLIT_OUTPUTS = 60;

/** Anonymous callers get far less headroom than an authenticated key. */
const IP_LIMIT_PER_MIN = 12;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

/** Some producers emit leading whitespace/BOM before %PDF-, hence the scan. */
function assertLooksLikePdf(bytes: Uint8Array, label: string) {
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (
      head[i] === PDF_MAGIC[0] && head[i + 1] === PDF_MAGIC[1] &&
      head[i + 2] === PDF_MAGIC[2] && head[i + 3] === PDF_MAGIC[3]
    ) return;
  }
  throw new Error(`${label}: not a valid PDF file`);
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  if (first) return first.split(",")[0].trim();
  const cf = req.headers["cf-connecting-ip"];
  return (Array.isArray(cf) ? cf[0] : cf) ?? "unknown";
}

function b64ToBytes(b64: string): Buffer {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  return Buffer.from(clean, "base64");
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "METHOD_NOT_ALLOWED", "Use POST");

  // Shared in-process limiter, keyed by IP rather than by user. Same caveat as
  // everywhere else: per warm instance, which is enough to stop a runaway loop.
  const rl = rateLimit(`ip:${clientIp(req)}`, IP_LIMIT_PER_MIN);
  if (!rl.ok) {
    return fail(res, 429, "RATE_LIMITED", "Too many requests. Try again in a minute.", {
      retry_after_seconds: rl.retryAfter,
    });
  }

  try {
    // Vercel parses application/json for us; anything else arrives as a string.
    const raw = req.body;
    const body = (typeof raw === "string" ? JSON.parse(raw) : (raw ?? {})) as Record<string, unknown>;

    const op = String(body.op ?? "");
    const files = Array.isArray(body.files) ? body.files : [];
    const options = (body.options ?? {}) as Record<string, unknown>;

    if (!files.length) return fail(res, 400, "INVALID_INPUT", "No files provided");
    if (files.length > MAX_FILES) {
      return fail(res, 400, "LIMIT_EXCEEDED", `Maximum ${MAX_FILES} files per job.`);
    }

    const decoded = files.map((f: { name?: string; type?: string; data: string }) => ({
      name: f.name ?? "file",
      type: f.type ?? "",
      bytes: b64ToBytes(f.data),
    }));

    const total = decoded.reduce((s, f) => s + f.bytes.length, 0);
    if (total > MAX_TOTAL_BYTES) {
      return fail(res, 413, "LIMIT_EXCEEDED", `Maximum ${MAX_TOTAL_BYTES / (1024 * 1024)} MB per job.`);
    }

    const out: { name: string; data: string; type: string }[] = [];
    let notes: Record<string, unknown> | null = null;

    if (op === "merge") {
      const doc = await PDFDocument.create();
      for (const [i, f] of decoded.entries()) {
        assertLooksLikePdf(f.bytes, `file ${i + 1}`);
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => doc.addPage(p));
      }
      // TODO(stage-3): switch to StorageProvider + temporary link
      out.push({
        name: "merged.pdf",
        type: "application/pdf",
        data: Buffer.from(await doc.save()).toString("base64"),
      });
    } else if (op === "split") {
      assertLooksLikePdf(decoded[0].bytes, "file 1");
      const src = await PDFDocument.load(decoded[0].bytes, { ignoreEncryption: true });
      const pageCount = src.getPageCount();
      const groups = parseRanges(String(options.ranges ?? ""), pageCount);
      if (!groups.length) return fail(res, 400, "INVALID_INPUT", "No valid ranges.");
      if (groups.length > MAX_SPLIT_OUTPUTS) {
        return fail(res, 400, "LIMIT_EXCEEDED", `Maximum ${MAX_SPLIT_OUTPUTS} output files.`);
      }
      const base = decoded[0].name.replace(/\.pdf$/i, "");
      for (const group of groups) {
        const doc = await PDFDocument.create();
        const pages = await doc.copyPages(src, group);
        pages.forEach((p) => doc.addPage(p));
        const label =
          group.length === 1
            ? `p${group[0] + 1}`
            : `p${group[0] + 1}-${group[group.length - 1] + 1}`;
        // TODO(stage-3): switch to StorageProvider + temporary link
        out.push({
          name: `${base}_${label}.pdf`,
          type: "application/pdf",
          data: Buffer.from(await doc.save()).toString("base64"),
        });
      }
    } else if (op === "compress") {
      assertLooksLikePdf(decoded[0].bytes, "file 1");
      const src = await PDFDocument.load(decoded[0].bytes, { ignoreEncryption: true });
      src.setTitle("");
      src.setAuthor("");
      src.setSubject("");
      src.setKeywords([]);
      src.setProducer("PDFly");
      src.setCreator("PDFly");
      const saved = await src.save({ useObjectStreams: true });
      // The deep (raster) compression path is browser-only, because it needs a
      // canvas. Server-side we perform the lossless structure pass and report
      // honestly whether the caller's target was reached.
      const target = Number(options.targetBytes ?? 0);
      // TODO(stage-3): switch to StorageProvider + temporary link
      out.push({
        name: decoded[0].name.replace(/\.pdf$/i, "_compressed.pdf"),
        type: "application/pdf",
        data: Buffer.from(saved).toString("base64"),
      });
      notes = {
        mode: "lossless",
        target_bytes: target || null,
        target_met: target ? saved.length <= target : null,
      };
    } else if (op === "images-to-pdf") {
      const doc = await PDFDocument.create();
      for (const f of decoded) {
        const isPng = f.type.includes("png") || /\.png$/i.test(f.name);
        const img = isPng ? await doc.embedPng(f.bytes) : await doc.embedJpg(f.bytes);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      // TODO(stage-3): switch to StorageProvider + temporary link
      out.push({
        name: "images.pdf",
        type: "application/pdf",
        data: Buffer.from(await doc.save()).toString("base64"),
      });
    } else {
      return fail(res, 400, "INVALID_INPUT", `Unsupported operation: ${op}`);
    }

    return ok(res, { success: true, files: out, retained: false, ...(notes ? { notes } : {}) });
  } catch (err) {
    // Deliberately does not log request contents — only the error name.
    console.error("[api/pdf-fallback] failed:", (err as Error).name);
    return fail(res, 500, "PROCESSING_FAILED", (err as Error).message);
  }
}
