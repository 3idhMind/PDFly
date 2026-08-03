/**
 * Fast PDF analysis used by the Compress tool.
 *
 * Samples a handful of pages (never the whole document) so the answer arrives
 * in well under a second even for 500-page files, then reports what kind of
 * PDF this is and how small it can realistically get.
 */

export type PdfKind = "scanned" | "mixed" | "text";

export interface PdfAnalysis {
  bytes: number;
  pages: number;
  kind: PdfKind;
  /** Best realistic output size in bytes for this specific file. */
  floorBytes: number;
  /** Human summary of what to expect. */
  verdict: string;
  /** Average widest page dimension in points (used to pick sane DPI). */
  avgWidthPt: number;
}

const SAMPLE_PAGES = 6;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerMod: { default: string } = await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

export async function analyzePdf(file: File): Promise<PdfAnalysis> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const pages = doc.numPages;

  const step = Math.max(1, Math.floor(pages / SAMPLE_PAGES));
  const indices: number[] = [];
  for (let i = 1; i <= pages && indices.length < SAMPLE_PAGES; i += step) indices.push(i);

  let totalChars = 0;
  let imageOps = 0;
  let widthSum = 0;

  for (const i of indices) {
    const page = await doc.getPage(i);
    widthSum += page.getViewport({ scale: 1 }).width;
    try {
      const text = await page.getTextContent();
      totalChars += text.items.reduce(
        (s, it) => s + ((it as { str?: string }).str?.length ?? 0),
        0,
      );
    } catch {
      /* ignore */
    }
    try {
      const ops = await page.getOperatorList();
      const paint = pdfjs.OPS.paintImageXObject;
      const inline = pdfjs.OPS.paintInlineImageXObject;
      for (const fn of ops.fnArray) {
        if (fn === paint || fn === inline) imageOps++;
      }
    } catch {
      /* ignore */
    }
  }

  const sampled = indices.length || 1;
  const charsPerPage = totalChars / sampled;
  const imagesPerPage = imageOps / sampled;
  const bytesPerPage = file.size / Math.max(1, pages);

  // Bytes-per-page is the most reliable signal: text pages are tiny, image
  // pages are fat. Image-operator counts are a secondary hint only.
  let kind: PdfKind;
  const imageish = imagesPerPage >= 0.5;
  if (charsPerPage < 200 && (bytesPerPage > 150 * 1024 || (imageish && bytesPerPage > 60 * 1024))) {
    kind = "scanned";
  } else if (bytesPerPage > 90 * 1024 || (imageish && bytesPerPage > 40 * 1024)) {
    kind = "mixed";
  } else {
    kind = "text";
  }


  // Realistic floor: a rasterised page at low DPI lands around 25–60 KB.
  const rasterFloor = pages * 28 * 1024;
  const floorBytes =
    kind === "text"
      ? Math.round(file.size * 0.85)
      : Math.max(Math.round(file.size * 0.03), Math.min(rasterFloor, Math.round(file.size * 0.9)));

  const verdict =
    kind === "scanned"
      ? "Scanned / image-heavy — large savings possible (often 80–95%)."
      : kind === "mixed"
        ? "Mixed text and images — moderate to large savings possible."
        : "Text-based PDF — already compact. Savings will be small; that's the content itself, not the tool.";

  return {
    bytes: file.size,
    pages,
    kind,
    floorBytes,
    verdict,
    avgWidthPt: widthSum / sampled || 595,
  };
}
