import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_SIZE = 5 * 1024 * 1024;
const MAX_BATCH_COMPLEXITY = 10;
const MAX_TABLES_PER_DOC = 50;
const MAX_TAGS_PER_DOC = 5000;
const WARN_TABLES = 20;
const WARN_TAGS = 2000;
const RENDER_TIMEOUT_MS = 30000;
const MAX_CUMULATIVE_OUTPUT_BYTES = 20 * 1024 * 1024;
const JWT_RATE_LIMIT = 10;
const JWT_RATE_WINDOW_MS = 5 * 60 * 1000;

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

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Complexity Scoring ──────────────────────────────────────────────

function getComplexityScore(contentLength: number): number {
  const sizeKB = contentLength / 1024;
  if (sizeKB < 50) return 1;
  if (sizeKB < 200) return 2;
  return 4; // 200KB–500KB
}

function countHtmlPatterns(content: string): { tables: number; tags: number } {
  const tableMatches = content.match(/<table[\s>]/gi);
  const tagMatches = content.match(/<[a-z][^>]*>/gi);
  return {
    tables: tableMatches?.length ?? 0,
    tags: tagMatches?.length ?? 0,
  };
}

// ─── Smart HTML Parser ───────────────────────────────────────────────

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

// ─── CSS Parsing Helpers (for use_raw_html mode) ─────────────────────

function extractStyleBlocks(html: string): { cleanedHtml: string; styles: Record<string, Record<string, string>> } {
  const styles: Record<string, Record<string, string>> = {};
  const cleanedHtml = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, cssContent) => {
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(cssContent)) !== null) {
      const selector = ruleMatch[1].trim().toLowerCase();
      const declarations = ruleMatch[2].trim();
      const props: Record<string, string> = {};
      declarations.split(";").forEach(decl => {
        const [prop, val] = decl.split(":").map(s => s.trim());
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
  styleMatch[1].split(";").forEach(decl => {
    const [prop, val] = decl.split(":").map(s => s.trim());
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
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
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

// ─── HTML to Blocks Parser ───────────────────────────────────────────

function parseHtmlToBlocks(html: string, useRawHtml = false): TextBlock[] {
  const blocks: TextBlock[] = [];
  let globalStyles: Record<string, Record<string, string>> = {};

  let workingHtml = html;
  if (useRawHtml) {
    const extracted = extractStyleBlocks(html);
    workingHtml = extracted.cleanedHtml;
    globalStyles = extracted.styles;
  }

  if (!/<[a-z][\s\S]*>/i.test(workingHtml)) {
    const lines = workingHtml.split(/\n/);
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

  let normalized = workingHtml.replace(/<br\s*\/?>/gi, "\n").replace(/\r\n/g, "\n");

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
      const mergedStyle = { ...(globalStyles["table"] || {}), ...inlineStyle };
      tokens.push({
        pos: match.index,
        end: match.index + match[0].length,
        block: { type: "table", content: "", rows, style: mergedStyle },
      });
    }
  }

  // Headings
  const hRe = /<h([1-6])([^>]*)>([\s\S]*?)<\/h[1-6]>/gi;
  while ((match = hRe.exec(normalized)) !== null) {
    const level = parseInt(match[1]);
    const tagAttrs = match[2];
    const inner = stripInlineTags(match[3]);
    if (inner.trim()) {
      const inlineStyle = useRawHtml ? parseInlineStyle(tagAttrs) : {};
      const selectorStyle = globalStyles[`h${level}`] || {};
      const mergedStyle = { ...selectorStyle, ...inlineStyle };
      tokens.push({
        pos: match.index,
        end: match.index + match[0].length,
        block: { type: "heading", content: inner.trim(), level, style: mergedStyle },
      });
    }
  }

  // Unordered lists
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  while ((match = ulRe.exec(normalized)) !== null) {
    const listContent = match[1];
    const liRe2 = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRe2.exec(listContent)) !== null) {
      const inner = stripInlineTags(liMatch[1]);
      if (inner.trim()) {
        tokens.push({ pos: match.index, end: match.index + match[0].length, block: { type: "bullet", content: inner.trim() } });
      }
    }
  }

  // Ordered lists
  const olRe = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((match = olRe.exec(normalized)) !== null) {
    const listContent = match[1];
    const liRe3 = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    let itemNum = 1;
    while ((liMatch = liRe3.exec(listContent)) !== null) {
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
    const overlaps = tokens.some(t => pos >= t.pos && pos < t.end);
    if (overlaps) continue;
    const tagAttrs = match[1];
    const inner = processInlineFormatting(match[2]);
    if (inner.trim()) {
      const inlineStyle = useRawHtml ? parseInlineStyle(tagAttrs) : {};
      const selectorStyle = globalStyles["p"] || {};
      const mergedStyle = { ...selectorStyle, ...inlineStyle };
      tokens.push({
        pos: match.index,
        end: match.index + match[0].length,
        block: { type: "paragraph", content: inner.trim(), style: mergedStyle },
      });
    }
  }

  // Divs
  const divRe = /<div([^>]*)>([\s\S]*?)<\/div>/gi;
  while ((match = divRe.exec(normalized)) !== null) {
    const pos = match.index;
    const overlaps = tokens.some(t => pos >= t.pos && pos < t.end);
    if (overlaps) continue;
    const tagAttrs = match[1];
    const inner = processInlineFormatting(match[2]);
    if (inner.trim()) {
      const inlineStyle = useRawHtml ? parseInlineStyle(tagAttrs) : {};
      tokens.push({
        pos: match.index,
        end: match.index + match[0].length,
        block: { type: "paragraph", content: inner.trim(), style: inlineStyle },
      });
    }
  }

  tokens.sort((a, b) => a.pos - b.pos);

  if (tokens.length === 0) {
    const plain = normalized.replace(/<[^>]+>/g, "").trim();
    if (plain) {
      const lines = plain.split(/\n+/);
      for (const line of lines) {
        if (line.trim()) blocks.push({ type: "text", content: decodeEntities(line.trim()) });
      }
    }
  } else {
    for (const token of tokens) {
      blocks.push(token.block);
    }
  }

  return blocks;
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

// ─── PDF Renderer ────────────────────────────────────────────────────

function renderPdf(
  doc: { title: string; content: string },
  templateId: string | null,
  pageDims: { w: number; h: number },
  useRawHtml: boolean
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

  // ── Title & Header (only in template mode) ──
  if (!isRaw) {
    pdf.setFontSize(style.titleSize);
    pdf.setTextColor(style.titleColor[0], style.titleColor[1], style.titleColor[2]);
    pdf.text(doc.title, margin, 25);

    const titleWidth = pdf.getTextWidth(doc.title);
    if (style.headerStyle === "underline") {
      pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 28, margin + titleWidth, 28);
    } else if (style.headerStyle === "thick-line") {
      pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
      pdf.setLineWidth(1.5);
      pdf.line(margin, 29, pageDims.w - margin, 29);
    } else if (style.headerStyle === "accent-line") {
      pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
      pdf.setLineWidth(0.8);
      pdf.line(margin, 28, margin + 40, 28);
    } else if (style.headerStyle === "box") {
      pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
      pdf.setLineWidth(0.5);
      pdf.rect(margin - 3, 15, maxWidth + 6, 18);
    } else if (style.headerStyle === "double-line") {
      pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
      pdf.setLineWidth(0.3);
      pdf.line(margin, 28, pageDims.w - margin, 28);
      pdf.line(margin, 29.5, pageDims.w - margin, 29.5);
    } else if (style.headerStyle === "gold-line") {
      pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
      pdf.setLineWidth(1);
      pdf.line(margin, 28, pageDims.w - margin, 28);
    }

    pdf.setFontSize(9);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`Generated on ${new Date().toLocaleDateString()} • Template: ${templateId}`, margin, 35);
    y = 42;
  }

  // ── Parse and render content ──
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
        const colCount = Math.max(...block.rows.map(r => r.length));
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
        const bulletMaxWidth = maxWidth - bulletIndent;
        const bLines = pdf.splitTextToSize(block.content, bulletMaxWidth);

        if (!isRaw) {
          pdf.setFillColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
        } else {
          pdf.setFillColor(80, 80, 80);
        }
        pdf.circle(margin + 2.5, y - 1.2, 0.8, "F");

        for (let i = 0; i < bLines.length; i++) {
          checkPageBreak(bodyLineHeight);
          pdf.text(bLines[i], margin + bulletIndent, y);
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
        const numMaxWidth = maxWidth - numIndent;
        const nLines = pdf.splitTextToSize(block.content, numMaxWidth);

        pdf.setFont("helvetica", "bold");
        if (!isRaw) {
          pdf.setTextColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
        } else {
          pdf.setTextColor(80, 80, 80);
        }
        pdf.text(`${block.level}.`, margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(50, 50, 50);

        for (let i = 0; i < nLines.length; i++) {
          checkPageBreak(bodyLineHeight);
          pdf.text(nLines[i], margin + numIndent, y);
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
        const subLines = block.content.split("\n");
        for (const subLine of subLines) {
          if (!subLine.trim()) {
            y += currentLineHeight * 0.3;
            continue;
          }
          const wrapped = pdf.splitTextToSize(subLine, maxWidth);
          for (const wl of wrapped) {
            checkPageBreak(currentLineHeight);
            pdf.text(wl, margin, y);
            y += currentLineHeight;
          }
        }

        if (block.type === "paragraph") {
          y += currentLineHeight * 0.4;
        }
        break;
      }
    }
  }

  // ── Footer on all pages ──
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    if (isRaw) {
      pdf.text(`Page ${i}/${totalPages}`, margin, pageDims.h - 5);
    } else {
      pdf.text(`Generated by PDFly • Template: ${templateId} • Page ${i}/${totalPages}`, margin, pageDims.h - 5);
    }
  }

  return new Uint8Array(pdf.output("arraybuffer"));
}

// ─── Dual auth: JWT session OR API key ───────────────────────────────
interface AuthResult {
  userId: string;
  authType: "jwt" | "apikey";
  apiKeyId?: string;
  rateLimitPerMin?: number;
}

async function authenticate(
  authHeader: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ result?: AuthResult; error?: Response }> {
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token || token.length < 10) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "Invalid authorization token" }) };
  }

  const isJwt = token.split(".").length === 3 && !token.startsWith("pdfgen_");

  if (isJwt) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data?.user) {
      return { error: jsonResponse(401, { error: "INVALID_TOKEN", message: "Invalid or expired session token" }) };
    }
    return { result: { userId: data.user.id, authType: "jwt" } };
  }

  // API key auth
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const { data: keyData, error: keyError } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, is_active, rate_limit_per_min")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !keyData) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "API key not found" }) };
  }
  if (!keyData.is_active) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "API key has been revoked" }) };
  }

  return {
    result: {
      userId: keyData.user_id,
      authType: "apikey",
      apiKeyId: keyData.id,
      rateLimitPerMin: keyData.rate_limit_per_min,
    },
  };
}

// ─── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "METHOD_NOT_ALLOWED", message: "Only POST requests are accepted" });
  }

  const startTime = Date.now();

  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return jsonResponse(413, { error: "PAYLOAD_TOO_LARGE", message: "Request body must be under 5MB" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "INVALID_KEY", message: "Missing Authorization header" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await authenticate(authHeader, supabaseAdmin);
    if (auth.error) return auth.error;
    const { userId, authType, apiKeyId, rateLimitPerMin } = auth.result!;

    // ── Rate limiting ──

    // JWT users: 10 requests per 5 minutes
    if (authType === "jwt") {
      const windowStart = new Date(Date.now() - JWT_RATE_WINDOW_MS).toISOString();
      const { count } = await supabaseAdmin
        .from("generated_documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", windowStart);

      if ((count ?? 0) >= JWT_RATE_LIMIT) {
        const retryAfter = Math.ceil(JWT_RATE_WINDOW_MS / 1000);
        return jsonResponse(429, {
          error: "RATE_LIMITED",
          message: "Please wait, the server is processing your previous requests. Try again in a few minutes.",
          retry_after: retryAfter,
        });
      }
    }

    // API key users: per-key rate limit
    if (authType === "apikey" && apiKeyId && rateLimitPerMin) {
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { count } = await supabaseAdmin
        .from("api_usage")
        .select("*", { count: "exact", head: true })
        .eq("api_key_id", apiKeyId)
        .gte("created_at", oneMinuteAgo);

      if ((count ?? 0) >= rateLimitPerMin) {
        return jsonResponse(429, {
          error: "RATE_LIMITED",
          message: `Rate limit exceeded. Max ${rateLimitPerMin} requests/minute.`,
          retry_after: 60,
        });
      }
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      const rawBody = await req.text();
      if (rawBody.length > MAX_BODY_SIZE) {
        return jsonResponse(413, { error: "PAYLOAD_TOO_LARGE", message: "Request body must be under 5MB" });
      }
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse(400, { error: "INVALID_INPUT", message: "Invalid JSON in request body" });
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

    if (!documents || !Array.isArray(documents) || documents.length === 0 || documents.length > 5) {
      return jsonResponse(400, { error: "INVALID_INPUT", message: "documents must be an array of 1-5 objects with title and content" });
    }

    for (const doc of documents) {
      if (!doc.title || typeof doc.title !== "string" || !doc.content || typeof doc.content !== "string") {
        return jsonResponse(400, { error: "INVALID_INPUT", message: "Each document must have a title (string) and content (string)" });
      }
      if (doc.title.length > 200 || doc.content.length > 500000) {
        return jsonResponse(400, { error: "INVALID_INPUT", message: "Title max 200 chars, content max 500,000 chars per document" });
      }
    }

    // ── Complexity scoring ──
    let totalComplexityScore = 0;
    const docScores: Array<{ title: string; score: number; sizeKB: number }> = [];
    
    for (const doc of documents) {
      const score = getComplexityScore(doc.content.length);
      totalComplexityScore += score;
      docScores.push({ title: doc.title, score, sizeKB: Math.round(doc.content.length / 1024) });
    }

    if (totalComplexityScore > MAX_BATCH_COMPLEXITY) {
      return jsonResponse(400, {
        error: "BATCH_TOO_COMPLEX",
        message: `Total batch complexity score is ${totalComplexityScore} (max ${MAX_BATCH_COMPLEXITY}). Reduce document sizes or send fewer documents.`,
        complexity_scores: docScores,
      });
    }

    // ── Content complexity check ──
    const warnings: string[] = [];

    for (const doc of documents) {
      const { tables, tags } = countHtmlPatterns(doc.content);
      
      if (tables > MAX_TABLES_PER_DOC) {
        return jsonResponse(400, {
          error: "CONTENT_TOO_COMPLEX",
          message: `Document "${doc.title}" has ${tables} tables (max ${MAX_TABLES_PER_DOC}). Simplify content.`,
        });
      }
      if (tags > MAX_TAGS_PER_DOC) {
        return jsonResponse(400, {
          error: "CONTENT_TOO_COMPLEX",
          message: `Document "${doc.title}" has ${tags} HTML tags (max ${MAX_TAGS_PER_DOC}). Simplify content.`,
        });
      }
      if (tables > WARN_TABLES) {
        warnings.push(`"${doc.title}" has ${tables} tables — processing may be slower.`);
      }
      if (tags > WARN_TAGS) {
        warnings.push(`"${doc.title}" has ${tags} HTML tags — processing may be slower.`);
      }
    }

    const isRawMode = use_raw_html === true;
    const finalTemplate = isRawMode ? null : (VALID_TEMPLATES.includes(template as string) ? (template as string) : "professional");
    const finalPageSize = Object.keys(PAGE_SIZES).includes(page_size as string) ? (page_size as string) : "A4";
    const pageDims = PAGE_SIZES[finalPageSize];

    // In template mode, warn about unsupported features
    if (!isRawMode) {
      const hasInlineCss = documents.some((d) => /<style\b|style\s*=/.test(d.content));
      const hasImages = documents.some((d) => /<img\b/.test(d.content));
      if (hasInlineCss) warnings.push("Template mode ignores CSS (style= / <style>). Use use_raw_html:true for custom styling, or use the website UI.");
      if (hasImages) warnings.push("Images (<img>) are not rendered in PDF generation.");
    }

    // ── Generate PDFs with timeout & memory guards ──
    const resultDocs: Array<{
      document_id: string;
      title: string;
      size_bytes: number;
      template: string | null;
      language: string;
      page_size: string;
      download_url: string;
      complexity_score: number;
    }> = [];

    let totalBytes = 0;

    for (let di = 0; di < documents.length; di++) {
      const doc = documents[di];
      const docId = crypto.randomUUID();
      const safeTitle = doc.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");

      // Timeout protection: wrap renderPdf in a race with timeout
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await Promise.race([
          Promise.resolve(renderPdf(doc, finalTemplate, pageDims, isRawMode)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), RENDER_TIMEOUT_MS)
          ),
        ]);
      } catch (timeoutErr) {
        if (timeoutErr instanceof Error && timeoutErr.message === "TIMEOUT") {
          // Return partial results if any, plus error for this doc
          if (resultDocs.length > 0) {
            warnings.push(`Document "${doc.title}" timed out after 30s. Partial results returned.`);
            break;
          }
          return jsonResponse(408, {
            error: "GENERATION_TIMEOUT",
            message: `Document "${doc.title}" took too long to render (>30s). Simplify content or reduce size.`,
          });
        }
        throw timeoutErr;
      }

      // Memory safeguard: check cumulative output
      totalBytes += pdfBytes.length;
      if (totalBytes > MAX_CUMULATIVE_OUTPUT_BYTES) {
        warnings.push(`Cumulative output exceeded 20MB after "${doc.title}". Remaining documents skipped.`);
        break;
      }

      const storagePath = `${userId}/${docId}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("generated-pdfs")
        .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });

      if (uploadError) {
        console.error(`Upload error for ${doc.title}:`, uploadError);
        return jsonResponse(500, { error: "GENERATION_FAILED", message: `Failed to store PDF: ${doc.title}` });
      }

      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from("generated-pdfs")
        .createSignedUrl(storagePath, 3600);

      if (urlError || !urlData?.signedUrl) {
        console.error(`URL error for ${doc.title}:`, urlError);
        return jsonResponse(500, { error: "GENERATION_FAILED", message: `Failed to generate download URL for: ${doc.title}` });
      }

      await supabaseAdmin.from("generated_documents").insert({
        id: docId,
        user_id: userId,
        title: doc.title,
        template: finalTemplate || "raw_html",
        language: language as string,
        page_size: finalPageSize,
        size_bytes: pdfBytes.length,
        storage_path: storagePath,
      });

      resultDocs.push({
        document_id: docId,
        title: `${safeTitle}.pdf`,
        size_bytes: pdfBytes.length,
        template: finalTemplate,
        language: language as string,
        page_size: finalPageSize,
        download_url: urlData.signedUrl,
        complexity_score: docScores[di].score,
      });
    }

    const processingTime = Date.now() - startTime;

    // Log usage for API key auth
    if (authType === "apikey" && apiKeyId) {
      await Promise.all([
        supabaseAdmin.from("api_usage").insert({
          api_key_id: apiKeyId,
          user_id: userId,
          endpoint: "/v1/generate-pdf",
          status: "success",
          document_count: documents.length,
          processing_time_ms: processingTime,
          bytes_processed: totalBytes,
        }),
        supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyId),
      ]);
    }

    return jsonResponse(200, {
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
        processing_time_ms: processingTime,
        bytes_processed: totalBytes,
      },
    });
  } catch (err) {
    console.error("generate-pdf error:", err);
    return jsonResponse(500, { error: "GENERATION_FAILED", message: "Internal server error" });
  }
});
