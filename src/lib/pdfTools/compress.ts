/**
 * PDFly adaptive PDF compressor (100% in-browser).
 *
 * Two passes:
 *  1. Lossless structure pass — strips metadata, rewrites with object streams.
 *     If that alone meets the target, we stop: zero quality loss.
 *  2. Adaptive raster pass — re-encodes page images at the *highest* quality
 *     that still fits the requested target size. Settings are chosen by
 *     estimating from a small page sample first, so we never waste a full
 *     render on a setting that was never going to fit.
 */

import { PDFDocument } from "pdf-lib";

export type QualityFloor = "maximum" | "balanced" | "small" | "smallest";

export interface CompressSetting {
  dpi: number;
  quality: number;
  gray?: boolean;
  label: string;
}

/** Ordered best → worst. */
export const SETTINGS: CompressSetting[] = [
  { dpi: 200, quality: 0.88, label: "Near-original" },
  { dpi: 170, quality: 0.82, label: "High" },
  { dpi: 150, quality: 0.78, label: "Good" },
  { dpi: 130, quality: 0.72, label: "Balanced" },
  { dpi: 110, quality: 0.65, label: "Readable" },
  { dpi: 96, quality: 0.58, label: "Compact" },
  { dpi: 84, quality: 0.5, label: "Small" },
  { dpi: 72, quality: 0.42, label: "Very small" },
  { dpi: 60, quality: 0.35, label: "Tiny" },
  { dpi: 54, quality: 0.3, gray: true, label: "Tiny (grayscale)" },
];

const FLOOR_INDEX: Record<QualityFloor, number> = {
  maximum: 2,
  balanced: 5,
  small: 7,
  smallest: SETTINGS.length - 1,
};

export interface CompressProgress {
  phase: "lossless" | "estimating" | "rendering" | "assembling";
  page?: number;
  total?: number;
  note?: string;
}

export interface CompressOptions {
  /** Desired maximum output size in bytes. */
  targetBytes?: number;
  qualityFloor?: QualityFloor;
  onProgress?: (p: CompressProgress) => void;
}

export interface CompressResult {
  blob: Blob;
  originalBytes: number;
  outputBytes: number;
  /** Label of the quality setting actually used, or "Lossless". */
  qualityUsed: string;
  /** True when the raster path ran (text layer replaced by page images). */
  rasterized: boolean;
  targetMet: boolean;
  pages: number;
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerMod: { default: string } = await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

async function losslessPass(bytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("PDFly");
  doc.setCreator("PDFly");
  return doc.save({ useObjectStreams: true, addDefaultPage: false });
}

type PdfPage = { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } };

async function renderPageJpeg(page: PdfPage, s: CompressSetting): Promise<Blob> {
  const scale = s.dpi / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;

  if (s.gray) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", s.quality),
  );
  // Release memory immediately — critical for large documents.
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

export async function compressPdf(
  file: File,
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const { targetBytes, qualityFloor = "balanced", onProgress } = opts;
  const source = await file.arrayBuffer();

  onProgress?.({ phase: "lossless" });
  const lossless = await losslessPass(source.slice(0));
  const losslessBytes = lossless.length;

  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: source.slice(0) }).promise;
  const pages = doc.numPages;

  const target = targetBytes ?? 0;
  const wantsRaster = target > 0 && losslessBytes > target;

  if (!wantsRaster) {
    return {
      blob: new Blob([lossless as BlobPart], { type: "application/pdf" }),
      originalBytes: file.size,
      outputBytes: losslessBytes,
      qualityUsed: "Lossless",
      rasterized: false,
      targetMet: target === 0 || losslessBytes <= target,
      pages,
    };
  }

  const maxIndex = FLOOR_INDEX[qualityFloor];

  // ---- Estimation pass: sample up to 4 pages to predict full-document size.
  onProgress?.({ phase: "estimating", note: "Working out the best quality that fits" });
  const sampleCount = Math.min(4, pages);
  const step = Math.max(1, Math.floor(pages / sampleCount));
  const sampleIdx: number[] = [];
  for (let i = 1; i <= pages && sampleIdx.length < sampleCount; i += step) sampleIdx.push(i);

  // Fixed overhead per PDF page object + container.
  const OVERHEAD = 2 * 1024;

  let chosen = maxIndex;
  for (let idx = 0; idx <= maxIndex; idx++) {
    const s = SETTINGS[idx];
    let sampleTotal = 0;
    for (const p of sampleIdx) {
      const page = await doc.getPage(p);
      const blob = await renderPageJpeg(page as unknown as PdfPage, s);
      sampleTotal += blob.size;
      await yieldToUi();
    }
    const estimate = (sampleTotal / sampleIdx.length + OVERHEAD) * pages;
    if (estimate <= target * 0.97) {
      chosen = idx;
      break;
    }
    chosen = idx; // keep the last (worst allowed) if nothing fits
  }

  // ---- Full render, with up to two step-downs if the estimate was optimistic.
  let attempt = 0;
  let bytesOut: Uint8Array | null = null;
  let used = SETTINGS[chosen];

  while (attempt < 3) {
    used = SETTINGS[Math.min(chosen + attempt, maxIndex)];
    const out = await PDFDocument.create();
    out.setProducer("PDFly");
    out.setCreator("PDFly");

    for (let i = 1; i <= pages; i++) {
      onProgress?.({ phase: "rendering", page: i, total: pages, note: used.label });
      const page = await doc.getPage(i);
      const blob = await renderPageJpeg(page as unknown as PdfPage, used);
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const vp = (page as unknown as PdfPage).getViewport({ scale: 1 });
      const newPage = out.addPage([vp.width, vp.height]);
      newPage.drawImage(jpg, { x: 0, y: 0, width: vp.width, height: vp.height });
      if (i % 3 === 0) await yieldToUi();
    }

    onProgress?.({ phase: "assembling" });
    bytesOut = await out.save({ useObjectStreams: true });

    if (bytesOut.length <= target || Math.min(chosen + attempt, maxIndex) >= maxIndex) break;
    attempt++;
  }

  const finalBytes = bytesOut!;
  // Never hand back something bigger than the lossless result.
  if (finalBytes.length >= losslessBytes) {
    return {
      blob: new Blob([lossless as BlobPart], { type: "application/pdf" }),
      originalBytes: file.size,
      outputBytes: losslessBytes,
      qualityUsed: "Lossless",
      rasterized: false,
      targetMet: losslessBytes <= target,
      pages,
    };
  }

  return {
    blob: new Blob([finalBytes as BlobPart], { type: "application/pdf" }),
    originalBytes: file.size,
    outputBytes: finalBytes.length,
    qualityUsed: used.label,
    rasterized: true,
    targetMet: finalBytes.length <= target,
    pages,
  };
}
