// Client-side PDF generator — 100% browser-only, zero upload.
// Mirrors the server `generate-pdf` Edge Function for the Web UI Text-to-PDF flow.
// REST API consumers continue to use the server function; this file is for the GUI only.

// jsPDF is dynamically imported inside generatePdfsClient() so the ~350KB
// library only loads when the user actually clicks Generate (code splitting).
import type { jsPDF as JsPdfType } from "jspdf";
import { pageSizes, DocumentSection } from "@/types/pdf";

export interface ClientGeneratedPdf {
  title: string;
  url: string;       // object URL (blob:)
  blob: Blob;
  sizeBytes: number;
}

export interface GenerateClientOptions {
  documents: DocumentSection[];
  template: string;
  pageSize: string;
  language: string;
  onProgress?: (current: number, total: number, stage: string) => void;
}

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

const PAGE_DIMS: Record<string, { w: number; h: number }> = Object.fromEntries(
  pageSizes.map((s) => [s.id, { w: s.width, h: s.height }])
);

const TEMPLATE_STYLES: Record<
  string,
  {
    titleColor: [number, number, number];
    accentColor: [number, number, number];
    bodySize: number;
    titleSize: number;
    headerStyle:
      | "none"
      | "underline"
      | "box"
      | "accent-line"
      | "double-line"
      | "gold-line"
      | "thick-line";
  }
> = {
  minimal:      { titleColor: [50, 50, 50],    accentColor: [150, 150, 150], bodySize: 11, titleSize: 20, headerStyle: "none" },
  professional: { titleColor: [30, 58, 138],   accentColor: [59, 130, 246],  bodySize: 11, titleSize: 22, headerStyle: "underline" },
  creative:     { titleColor: [147, 51, 234],  accentColor: [168, 85, 247],  bodySize: 11, titleSize: 24, headerStyle: "box" },
  modern:       { titleColor: [15, 23, 42],    accentColor: [14, 165, 233],  bodySize: 11, titleSize: 22, headerStyle: "accent-line" },
  classic:      { titleColor: [55, 48, 32],    accentColor: [120, 100, 60],  bodySize: 12, titleSize: 24, headerStyle: "double-line" },
  elegant:      { titleColor: [60, 60, 60],    accentColor: [180, 140, 80],  bodySize: 11, titleSize: 22, headerStyle: "gold-line" },
  bold:         { titleColor: [0, 0, 0],       accentColor: [220, 38, 38],   bodySize: 12, titleSize: 28, headerStyle: "thick-line" },
  tech:         { titleColor: [0, 200, 150],   accentColor: [0, 200, 150],   bodySize: 10, titleSize: 20, headerStyle: "accent-line" },
  academic:     { titleColor: [30, 30, 30],    accentColor: [100, 100, 100], bodySize: 12, titleSize: 20, headerStyle: "underline" },
  corporate:    { titleColor: [0, 51, 102],    accentColor: [0, 102, 178],   bodySize: 11, titleSize: 22, headerStyle: "box" },
  artistic:     { titleColor: [180, 50, 100],  accentColor: [220, 80, 130],  bodySize: 11, titleSize: 24, headerStyle: "accent-line" },
  clean:        { titleColor: [40, 40, 40],    accentColor: [100, 100, 100], bodySize: 11, titleSize: 20, headerStyle: "none" },
  vibrant:      { titleColor: [234, 88, 12],   accentColor: [249, 115, 22],  bodySize: 11, titleSize: 24, headerStyle: "thick-line" },
  dark:         { titleColor: [30, 30, 30],    accentColor: [100, 100, 100], bodySize: 11, titleSize: 22, headerStyle: "underline" },
  light:        { titleColor: [80, 80, 80],    accentColor: [180, 180, 180], bodySize: 11, titleSize: 20, headerStyle: "none" },
};

// ─── HTML → block parser (mirrors server's parser, simplified) ──────
interface TextBlock {
  type: "heading" | "paragraph" | "text" | "bullet" | "numbered" | "linebreak";
  content: string;
  level?: number;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "").trim());
}

function parseHtmlToBlocks(html: string): TextBlock[] {
  const blocks: TextBlock[] = [];

  // Plain text (no HTML) → split by lines
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    const lines = html.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") {
        blocks.push({ type: "linebreak", content: "" });
      } else {
        blocks.push({ type: "text", content: decodeEntities(trimmed) });
      }
    }
    return blocks;
  }

  const normalized = html.replace(/<br\s*\/?>/gi, "\n").replace(/\r\n/g, "\n");

  interface Token { pos: number; end: number; block: TextBlock }
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;

  // Headings
  const hRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  while ((m = hRe.exec(normalized)) !== null) {
    const inner = stripTags(m[2]);
    if (inner) tokens.push({ pos: m.index, end: m.index + m[0].length, block: { type: "heading", content: inner, level: parseInt(m[1]) } });
  }

  // Unordered lists
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  while ((m = ulRe.exec(normalized)) !== null) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li: RegExpExecArray | null;
    while ((li = liRe.exec(m[1])) !== null) {
      const inner = stripTags(li[1]);
      if (inner) tokens.push({ pos: m.index, end: m.index + m[0].length, block: { type: "bullet", content: inner } });
    }
  }

  // Ordered lists
  const olRe = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((m = olRe.exec(normalized)) !== null) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li: RegExpExecArray | null;
    let n = 1;
    while ((li = liRe.exec(m[1])) !== null) {
      const inner = stripTags(li[1]);
      if (inner) tokens.push({ pos: m.index, end: m.index + m[0].length, block: { type: "numbered", content: inner, level: n++ } });
    }
  }

  // Paragraphs / Divs
  for (const re of [/<p[^>]*>([\s\S]*?)<\/p>/gi, /<div[^>]*>([\s\S]*?)<\/div>/gi]) {
    while ((m = re.exec(normalized)) !== null) {
      const pos = m.index;
      if (tokens.some((t) => pos >= t.pos && pos < t.end)) continue;
      const inner = stripTags(m[1]);
      if (inner) tokens.push({ pos: m.index, end: m.index + m[0].length, block: { type: "paragraph", content: inner } });
    }
  }

  tokens.sort((a, b) => a.pos - b.pos);

  if (tokens.length === 0) {
    const plain = stripTags(normalized);
    if (plain) {
      for (const line of plain.split(/\n+/)) {
        if (line.trim()) blocks.push({ type: "text", content: line.trim() });
      }
    }
  } else {
    for (const t of tokens) blocks.push(t.block);
  }

  return blocks;
}

// ─── Single PDF render ──────────────────────────────────────────────
function renderPdf(
  jsPDFCtor: typeof import("jspdf").jsPDF,
  doc: DocumentSection,
  templateId: string,
  pageSize: string,
  language: string,
  fontFamily: string,
): Blob {
  const dims = PAGE_DIMS[pageSize] || PAGE_DIMS.A4;
  const style = TEMPLATE_STYLES[templateId] || TEMPLATE_STYLES.professional;
  const isRtl = RTL_LANGUAGES.has(language);

  const pdf = new jsPDFCtor({
    orientation: dims.w > dims.h ? "landscape" : "portrait",
    unit: "mm",
    format: [dims.w, dims.h],
  });

  const margin = 15;
  const maxWidth = dims.w - margin * 2;
  const footerHeight = 12;
  const pageBottom = dims.h - footerHeight;
  let y = margin;

  // Title
  pdf.setFontSize(style.titleSize);
  pdf.setTextColor(style.titleColor[0], style.titleColor[1], style.titleColor[2]);
  pdf.setFont(fontFamily, "bold");
  pdf.text(doc.title, isRtl ? dims.w - margin : margin, 25, { align: isRtl ? "right" : "left" });

  // Header decoration
  const titleWidth = pdf.getTextWidth(doc.title);
  pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
  switch (style.headerStyle) {
    case "underline":
      pdf.setLineWidth(0.5);
      pdf.line(margin, 28, margin + titleWidth, 28);
      break;
    case "thick-line":
      pdf.setLineWidth(1.5);
      pdf.line(margin, 29, dims.w - margin, 29);
      break;
    case "accent-line":
      pdf.setLineWidth(0.8);
      pdf.line(margin, 28, margin + 40, 28);
      break;
    case "box":
      pdf.setLineWidth(0.5);
      pdf.rect(margin - 3, 15, maxWidth + 6, 18);
      break;
    case "double-line":
      pdf.setLineWidth(0.3);
      pdf.line(margin, 28, dims.w - margin, 28);
      pdf.line(margin, 29.5, dims.w - margin, 29.5);
      break;
    case "gold-line":
      pdf.setLineWidth(1);
      pdf.line(margin, 28, dims.w - margin, 28);
      break;
  }

  pdf.setFontSize(9);
  pdf.setTextColor(140, 140, 140);
  pdf.setFont(fontFamily, "normal");
  pdf.text(`Generated ${new Date().toLocaleDateString()} • ${templateId}`, margin, 35);
  y = 42;

  // Body
  const blocks = parseHtmlToBlocks(doc.content);
  const bodySize = style.bodySize;
  const bodyLine = bodySize * 0.55;
  const headingSizes: Record<number, number> = { 1: bodySize + 8, 2: bodySize + 6, 3: bodySize + 4, 4: bodySize + 2, 5: bodySize + 1, 6: bodySize };

  const checkBreak = (need: number) => {
    if (y + need > pageBottom) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, size: number, bold: boolean, color: [number, number, number], indent = 0) => {
    pdf.setFontSize(size);
    pdf.setFont(fontFamily, bold ? "bold" : "normal");
    pdf.setTextColor(color[0], color[1], color[2]);
    const lh = size * 0.55;
    const wrapWidth = maxWidth - indent;
    const lines: string[] = pdf.splitTextToSize(text, wrapWidth);
    for (const line of lines) {
      checkBreak(lh);
      const x = isRtl ? dims.w - margin - indent : margin + indent;
      pdf.text(line, x, y, { align: isRtl ? "right" : "left" });
      y += lh;
    }
  };

  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        const size = headingSizes[b.level || 1] || bodySize + 4;
        y += size * 0.4;
        writeWrapped(b.content, size, true, style.titleColor);
        y += size * 0.2;
        break;
      }
      case "paragraph":
      case "text":
        writeWrapped(b.content, bodySize, false, [40, 40, 40]);
        y += bodyLine * 0.4;
        break;
      case "bullet":
        writeWrapped(`• ${b.content}`, bodySize, false, [40, 40, 40], 4);
        break;
      case "numbered":
        writeWrapped(`${b.level}. ${b.content}`, bodySize, false, [40, 40, 40], 4);
        break;
      case "linebreak":
        y += bodyLine;
        break;
    }
  }

  // Footer page numbers
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont(fontFamily, "normal");
    pdf.text(`Page ${p} of ${total}`, dims.w / 2, dims.h - 6, { align: "center" });
  }

  return pdf.output("blob");
}

// ─── Font lazy loading for non-Latin scripts ────────────────────────
// Detects script of content; loads matching Noto Sans variant on demand.
// Fonts are fetched from jsDelivr CDN (gstatic mirror) only when needed.
const FONT_URLS: Record<string, { url: string; family: string }> = {
  // MUST be .ttf. This previously fetched .woff from @fontsource and it never
  // worked: jsPDF's parser reads raw TrueType, WOFF is table-wise compressed,
  // and addFont fails with "No unicode cmap for font". jsPDF routes that error
  // through its PubSub, so nothing throws and nothing looks broken at the call
  // site — the text just silently doesn't render. Verified against jspdf@4.2.1.
  //
  // googlefonts/noto-fonts ships real hinted TTFs. @fontsource v5 publishes
  // woff/woff2 only, and the @expo-google-fonts CJK packages are OTF/CFF at
  // 4MB+ which jsPDF also cannot parse — hence no CJK entry here.
  devanagari: {
    url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
    family: "NotoDevanagari",
  },
  arabic: {
    url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf",
    family: "NotoArabic",
  },
};

const fontCache = new Map<string, string>(); // family -> base64

function detectScript(text: string, language: string): keyof typeof FONT_URLS | null {
  // Only scripts we have a working font for. ja/ko/zh used to map to a
  // Simplified-Chinese font containing no kana and no hangul, and `he` mapped
  // to the Arabic font — a different script entirely. Both produced
  // confident-looking garbage, which is worse than falling back to Latin.
  if (["hi", "mr", "sa", "ne"].includes(language)) return "devanagari";
  if (["ar", "fa", "ur"].includes(language)) return "arabic";
  if (/[\u0900-\u097F]/.test(text)) return "devanagari";
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF]/.test(text)) return "arabic";
  // No CJK branch: jsPDF cannot parse the OTF/CFF CJK fonts, and a full CJK
  // TTF is multi-megabyte \u2014 not something to push down a 4G connection mid-job.
  // CJK content falls back to Latin, which at least fails visibly rather than
  // pretending to have worked.
  return null;
}

async function loadFontBase64(url: string): Promise<string> {
  if (fontCache.has(url)) return fontCache.get(url)!;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  fontCache.set(url, b64);
  return b64;
}

async function ensureFont(
  pdfDoc: JsPdfType,
  scriptKey: keyof typeof FONT_URLS,
): Promise<string> {
  const { url, family } = FONT_URLS[scriptKey];
  const fileName = `${family}.ttf`;
  const b64 = await loadFontBase64(url);
  // jsPDF VFS API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfDoc as any).addFileToVFS(fileName, b64);
  pdfDoc.addFont(fileName, family, "normal");
  pdfDoc.addFont(fileName, family, "bold");
  return family;
}

// ─── Public API ─────────────────────────────────────────────────────
export async function generatePdfsClient(opts: GenerateClientOptions): Promise<ClientGeneratedPdf[]> {
  const { documents, template, pageSize, language, onProgress } = opts;
  const results: ClientGeneratedPdf[] = [];
  const total = documents.length;

  onProgress?.(0, total, "Loading PDF engine...");
  // Code-split: jsPDF only loaded when user actually generates
  const { jsPDF } = await import("jspdf");

  for (let i = 0; i < total; i++) {
    const doc = documents[i];
    onProgress?.(i, total, `Preparing "${doc.title}"...`);
    await new Promise((r) => setTimeout(r, 0));

    // Detect non-Latin script and lazy-load matching font
    const combined = `${doc.title}\n${doc.content}`;
    const scriptKey = detectScript(combined, language);
    let fontFamily = "helvetica";

    // Build a temp doc to attach the font (jsPDF needs font registered per-doc)
    const tempDims = PAGE_DIMS[pageSize] || PAGE_DIMS.A4;
    const probe = new jsPDF({
      orientation: tempDims.w > tempDims.h ? "landscape" : "portrait",
      unit: "mm",
      format: [tempDims.w, tempDims.h],
    });
    if (scriptKey) {
      try {
        onProgress?.(i, total, `Loading ${scriptKey} font...`);
        fontFamily = await ensureFont(probe, scriptKey);
      } catch (e) {
        console.warn("Font load failed, falling back to helvetica:", e);
      }
    }

    onProgress?.(i, total, `Generating "${doc.title}"...`);
    // We use the probe doc itself as our render target (already has font loaded)
    const blob = renderPdfWithDoc(probe, doc, template, pageSize, language, fontFamily);
    const url = URL.createObjectURL(blob);
    results.push({ title: doc.title, url, blob, sizeBytes: blob.size });
  }

  onProgress?.(total, total, "Complete!");
  return results;
}

// Renders into an existing pdf doc (so we can pre-load fonts).
function renderPdfWithDoc(
  pdf: JsPdfType,
  doc: DocumentSection,
  templateId: string,
  pageSize: string,
  language: string,
  fontFamily: string,
): Blob {
  // Just delegate to renderPdf body via a constructor wrapper — simplest:
  // re-implement by replacing the constructor call with our pre-built doc.
  // To avoid duplication, we monkey-patch a tiny shim:
  const FakeCtor = function () { return pdf; } as unknown as typeof import("jspdf").jsPDF;
  return renderPdf(FakeCtor, doc, templateId, pageSize, language, fontFamily);
}

