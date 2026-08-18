import type { jsPDF } from "jspdf";

/**
 * Non-Latin script support for the server-rendered PDFs.
 *
 * ── Why the API was Latin-only ────────────────────────────────────────────
 * `api/_lib/handlers/generate.ts` renders with jsPDF's built-in Helvetica,
 * which carries no glyphs outside Latin-1. Hindi, Arabic or Urdu sent to the
 * API came back as blank boxes or dropped characters, while the site advertised
 * broad language support. That was the "70+ languages" claim in O-8.
 *
 * The browser tool already solves this in `src/lib/clientPdfGenerator.ts` by
 * fetching a Noto TTF on demand. This is the same approach, moved server-side,
 * where it is actually cheaper: the font is fetched once per warm instance and
 * reused, instead of once per visitor.
 *
 * ── The traps, learned the hard way in the browser implementation ─────────
 * 1. **It must be a real TTF.** jsPDF parses raw TrueType tables. A WOFF is
 *    table-wise compressed and `addFont` fails with "No unicode cmap for font".
 *    Worse, jsPDF routes that failure through its PubSub, so nothing throws:
 *    the text silently does not render and the call site looks fine.
 * 2. **OTF/CFF fonts do not work either.** That is why there is no CJK entry.
 *    The Noto CJK families ship as OTF/CFF at 4 MB and up, and jsPDF cannot
 *    read them. Chinese, Japanese and Korean therefore fall back to Latin,
 *    which fails visibly rather than pretending to have worked.
 * 3. **Never map a language to the wrong script's font.** An earlier version
 *    mapped Hebrew to the Arabic font and Japanese to a Simplified Chinese one.
 *    Both produced confident-looking nonsense, which is worse than not
 *    rendering at all.
 *
 * ── Arabic shaping ────────────────────────────────────────────────────────
 * The glyphs render, but jsPDF does not do bidirectional reordering or
 * contextual joining, so Arabic and Urdu come out as separated letter forms in
 * logical order. That is legible but not correct typesetting, and callers are
 * told so rather than left to discover it. Proper shaping needs HarfBuzz,
 * which is a much larger change.
 */

/** Scripts we have a font for that jsPDF can actually parse. */
export type SupportedScript = "devanagari" | "arabic";

const FONTS: Record<SupportedScript, { url: string; family: string; label: string }> = {
  devanagari: {
    // googlefonts/noto-fonts ships genuine hinted TTFs. @fontsource v5 publishes
    // woff/woff2 only, which is exactly trap 1 above.
    url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf",
    family: "NotoDevanagari",
    label: "Devanagari (Hindi, Marathi, Sanskrit, Nepali)",
  },
  arabic: {
    url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf",
    family: "NotoArabic",
    label: "Arabic script (Arabic, Persian, Urdu)",
  },
};

/**
 * Cached per warm instance, as a promise so concurrent requests during a cold
 * start share one download rather than each fetching several hundred kilobytes.
 */
const cache = new Map<SupportedScript, Promise<string>>();

/** Language codes we trust more than the text sniffing below. */
const BY_LANGUAGE: Record<string, SupportedScript> = {
  hi: "devanagari",
  mr: "devanagari",
  sa: "devanagari",
  ne: "devanagari",
  ar: "arabic",
  fa: "arabic",
  ur: "arabic",
};

/**
 * Which script this content needs, or null for Latin.
 *
 * An explicit language wins over sniffing, because a document that is mostly
 * English with one Hindi heading still needs the Devanagari font loaded.
 */
export function detectScript(text: string, language?: string): SupportedScript | null {
  const lang = (language ?? "").toLowerCase().slice(0, 2);
  if (BY_LANGUAGE[lang]) return BY_LANGUAGE[lang];

  if (/[ऀ-ॿ]/.test(text)) return "devanagari";
  if (/[؀-ۿݐ-ݿﭐ-﷿]/.test(text)) return "arabic";

  // Deliberately no CJK branch. See trap 2.
  return null;
}

/** True when the text contains characters we know we cannot render. */
export function hasUnsupportedScript(text: string): boolean {
  // CJK ideographs, kana, hangul, Hebrew, Thai. All would silently degrade.
  return /[぀-ヿ㐀-䶿一-鿿가-힯֐-׿฀-๿]/.test(text);
}

async function fontBase64(script: SupportedScript): Promise<string> {
  const cached = cache.get(script);
  if (cached) return cached;

  const promise = (async () => {
    const res = await fetch(FONTS[script].url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`font fetch ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  })().catch((err) => {
    // Drop the failed promise so the next request retries instead of caching
    // a failure for the life of the instance.
    cache.delete(script);
    throw err;
  });

  cache.set(script, promise);
  return promise;
}

export interface FontResult {
  /** Font family to pass to pdf.setFont(). "helvetica" when nothing loaded. */
  family: string;
  script: SupportedScript | null;
  /** Warnings to surface in the API response. Never silent. */
  warnings: string[];
}

/**
 * Registers the right font on this jsPDF instance and returns what to use.
 *
 * Never throws. A CDN outage must downgrade the document to Latin with a
 * warning attached, not fail a request that would otherwise have produced a
 * perfectly good English PDF.
 */
export async function prepareFont(
  pdf: jsPDF,
  text: string,
  language?: string,
): Promise<FontResult> {
  const warnings: string[] = [];

  if (hasUnsupportedScript(text)) {
    warnings.push(
      "Chinese, Japanese, Korean, Hebrew and Thai are not supported by the API and will not " +
        "render correctly. Those scripts need font formats the PDF engine cannot read. Use the " +
        "browser tool at /text-to-pdf, or send Latin text.",
    );
  }

  const script = detectScript(text, language);
  if (!script) return { family: "helvetica", script: null, warnings };

  try {
    const base64 = await fontBase64(script);
    const { family } = FONTS[script];
    const file = `${family}.ttf`;

    pdf.addFileToVFS(file, base64);
    pdf.addFont(file, family, "normal");
    // jsPDF needs a bold entry to exist or setFont(family, "bold") silently
    // falls back to Helvetica mid-document, which looks like a rendering bug.
    // Noto Sans Regular stands in: a real bold is a second download for very
    // little gain.
    pdf.addFont(file, family, "bold");

    if (script === "arabic") {
      warnings.push(
        "Arabic script renders with correct glyphs but without bidirectional reordering or " +
          "contextual joining, so letters appear in separated forms. It is readable, but it is " +
          "not correct typesetting.",
      );
    }

    return { family, script, warnings };
  } catch (err) {
    console.error("[fonts] load failed:", (err as Error).name);
    warnings.push(
      `Could not load the ${FONTS[script].label} font, so this document rendered with Latin ` +
        "fonts and non-Latin characters may be missing. Try again shortly.",
    );
    return { family: "helvetica", script: null, warnings };
  }
}

/** Advertised on the docs page and in /api/system, from one place. */
export const SUPPORTED_SCRIPTS = Object.values(FONTS).map((f) => f.label);
