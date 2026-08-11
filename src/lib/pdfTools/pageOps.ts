import { PDFDocument, degrees } from "pdf-lib";

// Rotates the given 1-indexed pages (or every page, if `pages` is omitted) by
// `by` degrees (added to whatever rotation the page already has).
export async function rotatePdf(
  file: File,
  by: 90 | 180 | 270,
  pages?: number[],
): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const targets = pages ? pages.map((n) => n - 1) : doc.getPageIndices();
  targets.forEach((i) => {
    const page = doc.getPage(i);
    page.setRotation(degrees((page.getRotation().angle + by) % 360));
  });
  const out = await doc.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

// Removes the given 1-indexed pages from the PDF.
export async function deletePages(file: File, pagesToRemove: number[]): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const remove = new Set(pagesToRemove.map((n) => n - 1));
  const keep = src.getPageIndices().filter((i) => !remove.has(i));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  const bytesOut = await out.save();
  return new Blob([bytesOut as BlobPart], { type: "application/pdf" });
}

// Rebuilds the PDF with pages in the given 1-indexed order (must be a
// permutation of all page numbers).
export async function reorderPages(file: File, order: number[]): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order.map((n) => n - 1));
  pages.forEach((p) => out.addPage(p));
  const bytesOut = await out.save();
  return new Blob([bytesOut as BlobPart], { type: "application/pdf" });
}
