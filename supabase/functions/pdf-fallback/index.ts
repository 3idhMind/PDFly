// Public, anonymous, zero-retention PDF fallback for the web UI.
//
// Used only when a visitor's device cannot handle the job locally and they
// explicitly opted in. Everything happens in memory: no storage writes,
// no database rows, no logging of file contents. Results are returned in the
// same response and then discarded.

import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 40;

// Best-effort per-IP throttle (per warm instance).
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_LIMIT;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED", message: "Use POST" });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  if (rateLimited(ip)) {
    return json(429, { error: "RATE_LIMITED", message: "Too many requests. Try again in a minute." });
  }

  try {
    const body = await req.json();
    const op = String(body?.op ?? "");
    const files = Array.isArray(body?.files) ? body.files : [];
    const options = (body?.options ?? {}) as Record<string, unknown>;

    if (!files.length) return json(400, { error: "INVALID_INPUT", message: "No files provided" });
    if (files.length > MAX_FILES) {
      return json(400, { error: "LIMIT_EXCEEDED", message: `Maximum ${MAX_FILES} files per job.` });
    }

    const decoded = files.map((f: { name?: string; type?: string; data: string }) => ({
      name: f.name ?? "file",
      type: f.type ?? "",
      bytes: b64ToBytes(f.data),
    }));

    const total = decoded.reduce((s, f) => s + f.bytes.length, 0);
    if (total > MAX_TOTAL_BYTES) {
      return json(413, {
        error: "LIMIT_EXCEEDED",
        message: `Maximum ${MAX_TOTAL_BYTES / (1024 * 1024)} MB per job.`,
      });
    }

    const out: { name: string; data: string; type: string }[] = [];
    let notes: Record<string, unknown> | null = null;

    if (op === "merge") {
      const doc = await PDFDocument.create();
      for (const f of decoded) {
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => doc.addPage(p));
      }
      out.push({
        name: "merged.pdf",
        type: "application/pdf",
        data: bytesToB64(await doc.save()),
      });
    } else if (op === "split") {
      const src = await PDFDocument.load(decoded[0].bytes, { ignoreEncryption: true });
      const pageCount = src.getPageCount();
      const groups = parseRanges(String(options.ranges ?? ""), pageCount);
      if (!groups.length) return json(400, { error: "INVALID_INPUT", message: "No valid ranges." });
      if (groups.length > 60) {
        return json(400, { error: "LIMIT_EXCEEDED", message: "Maximum 60 output files." });
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
        out.push({
          name: `${base}_${label}.pdf`,
          type: "application/pdf",
          data: bytesToB64(await doc.save()),
        });
      }
    } else if (op === "compress") {
      const src = await PDFDocument.load(decoded[0].bytes, { ignoreEncryption: true });
      src.setTitle("");
      src.setAuthor("");
      src.setSubject("");
      src.setKeywords([]);
      src.setProducer("PDFly");
      src.setCreator("PDFly");
      const saved = await src.save({ useObjectStreams: true });
      // Note: the deep (raster) compression path is browser-only, because it
      // needs a canvas. Server-side we perform the lossless structure pass and
      // report honestly whether the caller's target was reached.
      const target = Number(options.targetBytes ?? 0);
      out.push({
        name: decoded[0].name.replace(/\.pdf$/i, "_compressed.pdf"),
        type: "application/pdf",
        data: bytesToB64(saved),
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
      out.push({
        name: "images.pdf",
        type: "application/pdf",
        data: bytesToB64(await doc.save()),
      });
    } else {
      return json(400, { error: "INVALID_INPUT", message: `Unsupported operation: ${op}` });
    }

    return json(200, { success: true, files: out, retained: false, ...(notes ? { notes } : {}) });
  } catch (err) {
    // Deliberately does not log request contents.
    console.error("pdf-fallback failed:", (err as Error).name);
    return json(500, { error: "PROCESSING_FAILED", message: (err as Error).message });
  }
});
