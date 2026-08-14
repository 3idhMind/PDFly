import type { VercelRequest, VercelResponse } from "@vercel/node";
import { jsPDF } from "jspdf";
import { fail, ok, handledPreflight } from "./_lib/http.js";
import { requireUser } from "./_lib/requireUser.js";
import { checkQuota, recordUsage, rateLimit, subjectOf } from "./_lib/quota.js";

/**
 * POST /api/generate-pdf — the main public endpoint: text or HTML in, PDF out.
 *
 * Ported from the Supabase edge function. The renderer is unchanged apart from
 * the runtime: jsPDF draws text directly, so there is no browser, no DOM and no
 * canvas involved and it runs identically under Node. What that also means is
 * that this is *not* an HTML engine — it understands a deliberate subset
 * (headings, paragraphs, lists, tables, and inline colour/size in raw mode) and
 * ignores the rest. See the caveats on language support further down.
 */

const MAX_BODY_SIZE = 5 * 1024 * 1024;
const MAX_BATCH_COMPLEXITY = 10;
const MAX_TABLES_PER_DOC = 50;
const MAX_TAGS_PER_DOC = 5000;
const WARN_TABLES = 20;
const WARN_TAGS = 2000;
const RENDER_BUDGET_MS = 30_000;
const MAX_CUMULATIVE_OUTPUT_BYTES = 20 * 1024 * 1024;
const MAX_DOCS_PER_REQUEST = 5;
const MAX_TITLE_CHARS = 200;
const MAX_CONTENT_CHARS = 500_000;

const PAGE_SIZES: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
  Tabloid: { w: 279.4, h: 431.8 },
  A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 },
  B5: { w: 176, h: 250 },
  Executive: { w: 184.15, h: 266.7 },
  Square: { w: 210, h: 210 },
  Reel: { w: 108, h: 192 },
  Presentation: { w: 254, h: 190.5 },
};

const VALID_TEMPLATES = [
  "minimal", "professional", "creative", "modern", "classic", "elegant",
  "bold", "tech", "academic", "corporate", "artistic", "clean", "vibrant", "dark", "light",
];

const TEMPLATE_STYLES: Record<string, { titleColor: number[]; accentColor: number[]; bodySize: number; titleSize: number; headerStyle: string }> = {
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

/* ------------------------------------------------------ complexity scoring */

/** Coarse cost estimate per document, so a batch can be refused before work starts. */
function getComplexityScore(contentLength: number): number {
  const sizeKB = contentLength / 1024;
  if (sizeKB < 50) return 1;
  if (sizeKB < 200) return 2;
  return 4; // 200KB–500KB
}

function countHtmlPatterns(content: string): { tables: number; tags: number } {
  const tableMatches = content.match(/<table[\s>]/gi);
  const tagMatches = content.match(/<[a-z][^>]*>/gi);
  return { tables: tableMatches?.length ?? 0, tags: tagMatches?.length ?? 0 };
}

/* ----------------------------------------------------------- HTML → blocks */

interface TextBlock {
  type: "heading" | "paragraph" | "text" | "bullet" | "numbered" | "linebreak" | "table";
  content: string;
  level?: number;
  bold?: boolean;
  italic?: boolean;
  rows?: string[][];
  style?: Record<string, string>;
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

/** Pulls <style> rules out into a selector → declarations map (raw-HTML mode only). */
function extractStyleBlocks(html: string): { cleanedHtml: string; styles: Record<string, Record<string, string>> } {
  const styles: Record<string, Record<string, string>> = {};
  const cleanedHtml = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, cssContent: string) => {
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(cssContent)) !== null) {
      const selector = ruleMatch[1].trim().toLowerCase();
      const props: Record<string, string> = {};
      ruleMatch[2].trim().split(";").forEach((decl) => {
        const [prop, val] = decl.split(":").map((s) => s.trim());
        if (prop && val) props[prop.toLowerCase()] = val;
      });
      styles[selector] = { ...(styles[selector] || {}), ...props };
    }
    return "";
  });
  return { cleanedHtml, styles };
}

function parseInlineStyle(tag: string): Record<string, string> {
  const styleMatch = tag.match(/style\s*=\s*["']([^"']+)["']/i);
  if (!styleMatch) return {};
  const props: Record<string, string> = {};
  styleMatch[1].split(";").forEach((decl) => {
    const [prop, val] = decl.split(":").map((s) => s.trim());
    if (prop && val) props[prop.toLowerCase()] = val;
  });
  return props;
}

function cssColorToRgb(color: string): number[] | null {
  const namedColors: Record<string, number[]> = {
    red: [255, 0, 0], blue: [0, 0, 255], green: [0, 128, 0], black: [0, 0, 0],
    white: [255, 255, 255], gray: [128, 128, 128], grey: [128, 128, 128],
    orange: [255, 165, 0], purple: [128, 0, 128], navy: [0, 0, 128],
    teal: [0, 128, 128], maroon: [128, 0, 0], yellow: [255, 255, 0],
  };
  const lower = color.toLowerCase().trim();
  if (namedColors[lower]) return namedColors[lower];

  const hexMatch = lower.match(/^#([0-9a-f]{3,6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  const rgbMatch = lower.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];

  return null;
}

function parseFontSize(val: string): number | null {
  const pxMatch = val.match(/([\d.]+)\s*px/);
  if (pxMatch) return parseFloat(pxMatch[1]) * 0.75;
  const ptMatch = val.match(/([\d.]+)\s*pt/);
  if (ptMatch) return parseFloat(ptMatch[1]);
  return null;
}

function stripInlineTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "").trim());
}

function processInlineFormatting(html: string): string {
  let text = html;
  text = text.replace(/<\/?(?:b|strong|i|em|u|s|strike|span|a|code|mark|small|sub|sup)[^>]*>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  return decodeEntities(text.trim());
}

/**
 * Flattens HTML into a linear list of drawable blocks.
 *
 * Each block type is matched independently and the results are re-sorted by
 * source position, which is why paragraphs and divs skip anything that starts
 * inside an already-claimed range — otherwise a <p> inside a <table> would be
 * emitted twice.
 */
function parseHtmlToBlocks(html: string, useRawHtml = false): TextBlock[] {
  const blocks: TextBlock[] = [];
  let globalStyles: Record<string, Record<string, string>> = {};

  let workingHtml = html;
  if (useRawHtml) {
    const extracted = extractStyleBlocks(html);
    workingHtml = extracted.cleanedHtml;
    globalStyles = extracted.styles;
  }

  // No tags at all: treat it as plain text, preserving blank lines.
  if (!/<[a-z][\s\S]*>/i.test(workingHtml)) {
    for (const line of workingHtml.split(/\n/)) {
      const trimmed = line.trim();
      if (trimmed === "") blocks.push({ type: "linebreak", content: "" });
      else blocks.push({ type: "text", content: decodeEntities(trimmed) });
    }
    return blocks;
  }

  const normalized = workingHtml.replace(/<br\s*\/?>/gi, "\n").replace(/\r\n/g, "\n");

  interface Token { pos: number; end: number; block: TextBlock }
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  // Tables
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  while ((match = tableRe.exec(normalized)) !== null) {
    const tableHtml = match[1];
    const rows: string[][] = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRe.exec(tableHtml)) !== null) {
      const cells: string[] = [];
      const cellRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(trMatch[1])) !== null) {
        cells.push(stripInlineTags(cellMatch[1]));
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) {
      const inlineStyle = useRawHtml ? parseInlineStyle(match[0]) : {};
      tokens.push({
        pos: match.index,
        end: match.index + match[0].length,
        block: { type: "table", content: "", rows, style: { ...(globalStyles["table"] || {}), ...inlineStyle } },
      });
    }
  }

  // Headings
  const hRe = /<h([1-6])([^>]*)>([\s\S]*?)<\/h[1-6]>/gi;
  while ((match = hRe.exec(normalized)) !== null) {
    const level = parseInt(match[1]);
    const inner = stripInlineTags(match[3]);
    if (inner.trim()) {
      const inlineStyle = useRawHtml ? parseInlineStyle(match[2]) : {};
      tokens.push({
        pos: match.index,
        end: match.index + match[0].length,
        block: { type: "heading", content: inner.trim(), level, style: { ...(globalStyles[`h${level}`] || {}), ...inlineStyle } },
      });
    }
  }

  // Unordered lists
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  while ((match = ulRe.exec(normalized)) !== null) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRe.exec(match[1])) !== null) {
      const inner = stripInlineTags(liMatch[1]);
      if (inner.trim()) {
        tokens.push({ pos: match.index, end: match.index + match[0].length, block: { type: "bullet", content: inner.trim() } });
      }
    }
  }

  // Ordered lists
  const olRe = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((match = olRe.exec(normalized)) !== null) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    let itemNum = 1;
    while ((liMatch = liRe.exec(match[1])) !== null) {
      const inner = stripInlineTags(liMatch[1]);
      if (inner.trim()) {
        tokens.push({ pos: match.index, end: match.index + match[0].length, block: { type: "numbered", content: inner.trim(), level: itemNum++ } });
      }
    }
  }

  // Paragraphs
  const pRe = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  while ((match = pRe.exec(normalized)) !== null) {
    const pos = match.index;
    if (tokens.some((t) => pos >= t.pos && pos < t.end)) continue;
    const inner = processInlineFormatting(match[2]);
    if (inner.trim()) {
      const inlineStyle = useRawHtml ? parseInlineStyle(match[1]) : {};
      tokens.push({
        pos,
        end: pos + match[0].length,
        block: { type: "paragraph", content: inner.trim(), style: { ...(globalStyles["p"] || {}), ...inlineStyle } },
      });
    }
  }

  // Divs
  const divRe = /<div([^>]*)>([\s\S]*?)<\/div>/gi;
  while ((match = divRe.exec(normalized)) !== null) {
    const pos = match.index;
    if (tokens.some((t) => pos >= t.pos && pos < t.end)) continue;
    const inner = processInlineFormatting(match[2]);
    if (inner.trim()) {
      const inlineStyle = useRawHtml ? parseInlineStyle(match[1]) : {};
      tokens.push({ pos, end: pos + match[0].length, block: { type: "paragraph", content: inner.trim(), style: inlineStyle } });
    }
  }

  tokens.sort((a, b) => a.pos - b.pos);

  if (tokens.length === 0) {
    // Tags present but none we handle — fall back to the stripped text so the
    // caller still gets their content rather than a blank page.
    const plain = normalized.replace(/<[^>]+>/g, "").trim();
    for (const line of plain.split(/\n+/)) {
      if (line.trim()) blocks.push({ type: "text", content: decodeEntities(line.trim()) });
    }
  } else {
    for (const token of tokens) blocks.push(token.block);
  }

  return blocks;
}

/* -------------------------------------------------------------- PDF render */

function renderPdf(
  doc: { title: string; content: string },
  templateId: string | null,
  pageDims: { w: number; h: number },
  useRawHtml: boolean,
): Uint8Array {
  const isRaw = useRawHtml && !templateId;
  const style = TEMPLATE_STYLES[templateId || "professional"] || TEMPLATE_STYLES.professional;
  const pdf = new jsPDF({
    orientation: pageDims.w > pageDims.h ? "landscape" : "portrait",
    unit: "mm",
    format: [pageDims.w, pageDims.h],
  });

  const margin = 15;
  const maxWidth = pageDims.w - margin * 2;
  const footerHeight = 12;
  const pageBottom = pageDims.h - footerHeight;

  let y = margin;

  // Title block, template mode only — raw mode is meant to be the caller's own
  // document, so we add nothing but the page footer.
  if (!isRaw) {
    pdf.setFontSize(style.titleSize);
    pdf.setTextColor(style.titleColor[0], style.titleColor[1], style.titleColor[2]);
    pdf.text(doc.title, margin, 25);

    const titleWidth = pdf.getTextWidth(doc.title);
    pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
    if (style.headerStyle === "underline") {
      pdf.setLineWidth(0.5);
      pdf.line(margin, 28, margin + titleWidth, 28);
    } else if (style.headerStyle === "thick-line") {
      pdf.setLineWidth(1.5);
      pdf.line(margin, 29, pageDims.w - margin, 29);
    } else if (style.headerStyle === "accent-line") {
      pdf.setLineWidth(0.8);
      pdf.line(margin, 28, margin + 40, 28);
    } else if (style.headerStyle === "box") {
      pdf.setLineWidth(0.5);
      pdf.rect(margin - 3, 15, maxWidth + 6, 18);
    } else if (style.headerStyle === "double-line") {
      pdf.setLineWidth(0.3);
      pdf.line(margin, 28, pageDims.w - margin, 28);
      pdf.line(margin, 29.5, pageDims.w - margin, 29.5);
    } else if (style.headerStyle === "gold-line") {
      pdf.setLineWidth(1);
      pdf.line(margin, 28, pageDims.w - margin, 28);
    }

    pdf.setFontSize(9);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`Generated on ${new Date().toLocaleDateString()} • Template: ${templateId}`, margin, 35);
    y = 42;
  }

  const blocks = parseHtmlToBlocks(doc.content, useRawHtml);
  const bodySize = isRaw ? 11 : style.bodySize;
  const bodyLineHeight = bodySize * 0.55;

  const headingSizes: Record<number, number> = {
    1: bodySize + 8, 2: bodySize + 6, 3: bodySize + 4,
    4: bodySize + 2, 5: bodySize + 1, 6: bodySize,
  };

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageBottom) {
      pdf.addPage();
      y = margin;
    }
  }

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const hSize = headingSizes[block.level || 1] || bodySize + 4;
        const cssSize = block.style?.["font-size"] ? parseFontSize(block.style["font-size"]) : null;
        const finalSize = cssSize || hSize;
        const hLineHeight = finalSize * 0.55;
        y += hLineHeight * 0.8;
        checkPageBreak(hLineHeight * 2);

        pdf.setFontSize(finalSize);
        pdf.setFont("helvetica", "bold");

        const cssColor = block.style?.color ? cssColorToRgb(block.style.color) : null;
        if (cssColor) {
          pdf.setTextColor(cssColor[0], cssColor[1], cssColor[2]);
        } else if (!isRaw) {
          pdf.setTextColor(style.titleColor[0], style.titleColor[1], style.titleColor[2]);
        } else {
          pdf.setTextColor(30, 30, 30);
        }

        const hLines = pdf.splitTextToSize(block.content, maxWidth);
        for (const line of hLines) {
          checkPageBreak(hLineHeight);
          pdf.text(line, margin, y);
          y += hLineHeight;
        }

        if (!isRaw && (block.level || 1) <= 2) {
          pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
          pdf.setLineWidth(0.3);
          pdf.line(margin, y, margin + Math.min(maxWidth, 60), y);
          y += 2;
        }
        y += hLineHeight * 0.3;
        break;
      }

      case "table": {
        if (!block.rows || block.rows.length === 0) break;
        const colCount = Math.max(...block.rows.map((r) => r.length));
        const colWidth = maxWidth / colCount;
        const rowHeight = bodyLineHeight + 3;

        for (let ri = 0; ri < block.rows.length; ri++) {
          checkPageBreak(rowHeight + 2);
          const row = block.rows[ri];
          const isHeader = ri === 0;

          for (let ci = 0; ci < colCount; ci++) {
            const cellX = margin + ci * colWidth;
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.2);
            pdf.rect(cellX, y - bodyLineHeight, colWidth, rowHeight);

            if (isHeader) {
              pdf.setFillColor(240, 240, 240);
              pdf.rect(cellX, y - bodyLineHeight, colWidth, rowHeight, "F");
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(30, 30, 30);
            } else {
              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(50, 50, 50);
            }

            pdf.setFontSize(bodySize - 1);
            // One line per cell: table layout here is fixed-height, so overflow
            // is truncated rather than allowed to overlap the next row.
            const cellText = (row[ci] || "").substring(0, 50);
            const lines = pdf.splitTextToSize(cellText, colWidth - 3);
            pdf.text(lines[0] || "", cellX + 1.5, y);
          }
          y += rowHeight;
        }
        y += 3;
        break;
      }

      case "bullet": {
        checkPageBreak(bodyLineHeight);
        pdf.setFontSize(bodySize);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(50, 50, 50);

        const bulletIndent = 8;
        const bLines = pdf.splitTextToSize(block.content, maxWidth - bulletIndent);

        if (!isRaw) pdf.setFillColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
        else pdf.setFillColor(80, 80, 80);
        pdf.circle(margin + 2.5, y - 1.2, 0.8, "F");

        for (const line of bLines) {
          checkPageBreak(bodyLineHeight);
          pdf.text(line, margin + bulletIndent, y);
          y += bodyLineHeight;
        }
        y += bodyLineHeight * 0.15;
        break;
      }

      case "numbered": {
        checkPageBreak(bodyLineHeight);
        pdf.setFontSize(bodySize);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(50, 50, 50);

        const numIndent = 10;
        const nLines = pdf.splitTextToSize(block.content, maxWidth - numIndent);

        pdf.setFont("helvetica", "bold");
        if (!isRaw) pdf.setTextColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
        else pdf.setTextColor(80, 80, 80);
        pdf.text(`${block.level}.`, margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(50, 50, 50);

        for (const line of nLines) {
          checkPageBreak(bodyLineHeight);
          pdf.text(line, margin + numIndent, y);
          y += bodyLineHeight;
        }
        y += bodyLineHeight * 0.15;
        break;
      }

      case "linebreak": {
        y += bodyLineHeight * 0.5;
        break;
      }

      case "paragraph":
      case "text":
      default: {
        checkPageBreak(bodyLineHeight);

        let fontSize = bodySize;
        let textColor: number[] = [50, 50, 50];
        if (block.style?.["font-size"]) {
          const cs = parseFontSize(block.style["font-size"]);
          if (cs) fontSize = cs;
        }
        if (block.style?.color) {
          const cc = cssColorToRgb(block.style.color);
          if (cc) textColor = cc;
        }

        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(textColor[0], textColor[1], textColor[2]);

        const currentLineHeight = fontSize * 0.55;
        for (const subLine of block.content.split("\n")) {
          if (!subLine.trim()) {
            y += currentLineHeight * 0.3;
            continue;
          }
          for (const wl of pdf.splitTextToSize(subLine, maxWidth)) {
            checkPageBreak(currentLineHeight);
            pdf.text(wl, margin, y);
            y += currentLineHeight;
          }
        }

        if (block.type === "paragraph") y += currentLineHeight * 0.4;
        break;
      }
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    if (isRaw) pdf.text(`Page ${i}/${totalPages}`, margin, pageDims.h - 5);
    else pdf.text(`Generated by PDFly • Template: ${templateId} • Page ${i}/${totalPages}`, margin, pageDims.h - 5);
  }

  return new Uint8Array(pdf.output("arraybuffer"));
}

/* ------------------------------------------------------------------ handler */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;
  if (req.method !== "POST") {
    return fail(res, 405, "METHOD_NOT_ALLOWED", "Only POST requests are accepted");
  }

  const startTime = Date.now();

  // Checked before the body is touched, so a huge payload is refused at the
  // header rather than after it has been buffered and parsed.
  const declaredLength = Number(
    Array.isArray(req.headers["content-length"]) ? req.headers["content-length"][0] : req.headers["content-length"],
  );
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_SIZE) {
    return fail(res, 413, "PAYLOAD_TOO_LARGE", "Request body must be under 5MB");
  }

  const caller = await requireUser(req, res);
  if (!caller) return;

  const rl = rateLimit(subjectOf(caller), caller.rateLimitPerMin);
  if (!rl.ok) {
    return fail(res, 429, "RATE_LIMITED", `Rate limit exceeded. Try again in ${rl.retryAfter}s.`, { retry_after_seconds: rl.retryAfter });
  }

  const quota = await checkQuota(caller.uid);
  if (!quota.allowed) {
    return fail(res, 402, "QUOTA_EXCEEDED", `Monthly free-tier limit of ${quota.limit} PDFs reached.`, { used: quota.used, limit: quota.limit });
  }

  try {
    // Vercel parses JSON bodies itself; a string only turns up when the caller
    // sent no (or a non-JSON) content type.
    let body: Record<string, unknown>;
    if (typeof req.body === "string") {
      try { body = JSON.parse(req.body); } catch { return fail(res, 400, "INVALID_INPUT", "Invalid JSON in request body"); }
    } else if (req.body && typeof req.body === "object") {
      body = req.body as Record<string, unknown>;
    } else {
      return fail(res, 400, "INVALID_INPUT", "Invalid JSON in request body");
    }

    const {
      documents,
      language = "auto",
      template = "professional",
      page_size = "A4",
      use_raw_html = false,
    } = body as {
      documents?: Array<{ title: string; content: string }>;
      language?: string;
      template?: string;
      page_size?: string;
      use_raw_html?: boolean;
    };

    if (!documents || !Array.isArray(documents) || documents.length === 0 || documents.length > MAX_DOCS_PER_REQUEST) {
      return fail(res, 400, "INVALID_INPUT", `documents must be an array of 1-${MAX_DOCS_PER_REQUEST} objects with title and content`);
    }

    for (const doc of documents) {
      if (!doc?.title || typeof doc.title !== "string" || !doc.content || typeof doc.content !== "string") {
        return fail(res, 400, "INVALID_INPUT", "Each document must have a title (string) and content (string)");
      }
      if (doc.title.length > MAX_TITLE_CHARS || doc.content.length > MAX_CONTENT_CHARS) {
        return fail(res, 400, "INVALID_INPUT", "Title max 200 chars, content max 500,000 chars per document");
      }
    }

    let totalComplexityScore = 0;
    const docScores: Array<{ title: string; score: number; sizeKB: number }> = [];
    for (const doc of documents) {
      const score = getComplexityScore(doc.content.length);
      totalComplexityScore += score;
      docScores.push({ title: doc.title, score, sizeKB: Math.round(doc.content.length / 1024) });
    }

    if (totalComplexityScore > MAX_BATCH_COMPLEXITY) {
      return fail(
        res, 400, "BATCH_TOO_COMPLEX",
        `Total batch complexity score is ${totalComplexityScore} (max ${MAX_BATCH_COMPLEXITY}). Reduce document sizes or send fewer documents.`,
        { complexity_scores: docScores },
      );
    }

    const warnings: string[] = [];

    for (const doc of documents) {
      const { tables, tags } = countHtmlPatterns(doc.content);
      if (tables > MAX_TABLES_PER_DOC) {
        return fail(res, 400, "CONTENT_TOO_COMPLEX", `Document "${doc.title}" has ${tables} tables (max ${MAX_TABLES_PER_DOC}). Simplify content.`);
      }
      if (tags > MAX_TAGS_PER_DOC) {
        return fail(res, 400, "CONTENT_TOO_COMPLEX", `Document "${doc.title}" has ${tags} HTML tags (max ${MAX_TAGS_PER_DOC}). Simplify content.`);
      }
      if (tables > WARN_TABLES) warnings.push(`"${doc.title}" has ${tables} tables — processing may be slower.`);
      if (tags > WARN_TAGS) warnings.push(`"${doc.title}" has ${tags} HTML tags — processing may be slower.`);
    }

    const isRawMode = use_raw_html === true;
    const finalTemplate = isRawMode ? null : (VALID_TEMPLATES.includes(template as string) ? (template as string) : "professional");
    const finalPageSize = Object.keys(PAGE_SIZES).includes(page_size as string) ? (page_size as string) : "A4";
    const pageDims = PAGE_SIZES[finalPageSize];

    if (!isRawMode) {
      const hasInlineCss = documents.some((d) => /<style\b|style\s*=/.test(d.content));
      const hasImages = documents.some((d) => /<img\b/.test(d.content));
      if (hasInlineCss) warnings.push("Template mode ignores CSS (style= / <style>). Use use_raw_html:true for custom styling, or use the website UI.");
      if (hasImages) warnings.push("Images (<img>) are not rendered in PDF generation.");
    }

    const resultDocs: Array<{
      document_id: string;
      title: string;
      size_bytes: number;
      template: string | null;
      language: string;
      page_size: string;
      pdf_base64: string;
      complexity_score: number;
    }> = [];

    let totalBytes = 0;
    let renderBudgetMs = RENDER_BUDGET_MS;

    for (let di = 0; di < documents.length; di++) {
      const doc = documents[di];

      // The Deno version raced renderPdf against a timer. That never actually
      // fired: rendering is synchronous, so it blocks the loop the timer needs.
      // Instead we spend a total render budget and stop before starting another
      // document once it is gone — which does bound the work, and keeps us
      // inside the platform's own function timeout.
      if (di > 0 && renderBudgetMs <= 0) {
        warnings.push(`Render budget of ${RENDER_BUDGET_MS / 1000}s exhausted before "${doc.title}". Remaining documents skipped.`);
        break;
      }

      const docId = crypto.randomUUID();
      const safeTitle = doc.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");

      const renderStart = Date.now();
      const pdfBytes = renderPdf(doc, finalTemplate, pageDims, isRawMode);
      renderBudgetMs -= Date.now() - renderStart;

      totalBytes += pdfBytes.length;
      if (totalBytes > MAX_CUMULATIVE_OUTPUT_BYTES) {
        warnings.push(`Cumulative output exceeded 20MB after "${doc.title}". Remaining documents skipped.`);
        break;
      }

      // TODO(stage-3): switch to StorageProvider + temporary link
      // Until object storage exists the bytes ride back inside the JSON, which
      // is also why the practical batch size is far below the 20MB cap here:
      // base64 adds a third, and the platform caps a serverless response well
      // under that. A signed link removes both constraints.
      resultDocs.push({
        document_id: docId,
        title: `${safeTitle}.pdf`,
        size_bytes: pdfBytes.length,
        template: finalTemplate,
        language: language as string,
        page_size: finalPageSize,
        pdf_base64: Buffer.from(pdfBytes).toString("base64"),
        complexity_score: docScores[di].score,
      });
    }

    await recordUsage(caller.uid, { pdfs: resultDocs.length, apiCalls: 1, bytes: totalBytes });

    return ok(res, {
      success: true,
      api_version: "v1",
      documents: resultDocs,
      warnings: warnings.length ? warnings : undefined,
      complexity: {
        total_score: totalComplexityScore,
        max_allowed: MAX_BATCH_COMPLEXITY,
        per_document: docScores,
      },
      usage: {
        documents_generated: resultDocs.length,
        processing_time_ms: Date.now() - startTime,
        bytes_processed: totalBytes,
      },
    });
  } catch (err) {
    // Name only — the message can quote the caller's document content.
    console.error("[api/generate-pdf] failed:", (err as Error).name);
    return fail(res, 500, "GENERATION_FAILED", "Internal server error");
  }
}
