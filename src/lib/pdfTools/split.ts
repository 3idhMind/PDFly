import { PDFDocument } from "pdf-lib";

// Parse "1-3, 5, 7-9" into 0-indexed page arrays (one PDF per group)
export function parseRanges(input: string, totalPages: number): number[][] {
  const groups: number[][] = [];
  input.split(",").forEach((raw) => {
    const part = raw.trim();
    if (!part) return;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1]));
      const b = Math.min(totalPages, parseInt(m[2]));
      if (a <= b) groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
    } else {
      const n = parseInt(part);
      if (!isNaN(n) && n >= 1 && n <= totalPages) groups.push([n - 1]);
    }
  });
  return groups;
}

export async function splitPdf(
  file: File,
  ranges: string,
): Promise<{ name: string; blob: Blob }[]> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const groups = parseRanges(ranges, total);
  if (groups.length === 0) throw new Error("No valid page ranges");

  const base = file.name.replace(/\.pdf$/i, "");
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < groups.length; i++) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, groups[i]);
    pages.forEach((p) => doc.addPage(p));
    const bytesOut = await doc.save();
    const range = groups[i];
    const label =
      range.length === 1 ? `p${range[0] + 1}` : `p${range[0] + 1}-${range[range.length - 1] + 1}`;
    out.push({
      name: `${base}_${label}.pdf`,
      blob: new Blob([bytesOut as BlobPart], { type: "application/pdf" }),
    });
  }
  return out;
}
