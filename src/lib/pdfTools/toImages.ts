// Renders each page of a PDF to a PNG/JPEG using pdfjs-dist (lazy loaded)

export async function pdfToImages(
  file: File,
  opts: { format: "png" | "jpeg"; dpi: number; quality?: number } = { format: "png", dpi: 150 },
): Promise<{ name: string; blob: Blob }[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod: { default: string } = await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  );
  const workerUrl = workerMod.default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const bytes = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const base = file.name.replace(/\.pdf$/i, "");
  const scale = opts.dpi / 72;
  const results: { name: string; blob: Blob }[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    // `canvas` is accepted at runtime but missing from this pdf.js release's
    // RenderParameters, so the argument is widened to the function's own
    // parameter type rather than to `any` — a genuinely wrong field still fails.
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    } as Parameters<typeof page.render>[0]).promise;
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob(
        (b) => resolve(b!),
        opts.format === "jpeg" ? "image/jpeg" : "image/png",
        opts.quality ?? 0.92,
      ),
    );
    results.push({
      name: `${base}_page_${String(i).padStart(3, "0")}.${opts.format === "jpeg" ? "jpg" : "png"}`,
      blob,
    });
  }
  return results;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  return doc.getPageCount();
}
