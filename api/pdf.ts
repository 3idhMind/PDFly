import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handledPreflight, operationFrom } from "./_lib/http.js";
import { describeStorage } from "./_lib/storage.js";

/**
 * Every PDF operation, behind one namespace.
 *
 * ── Why one function instead of seven ─────────────────────────────────────
 * Each file directly under `api/` becomes its own Serverless Function, and the
 * Hobby plan allows twelve per deployment. Seven separate PDF endpoints spent
 * more than half that budget on one product area and had already caused a
 * failed deployment once. A `[...path]` catch-all is a single function that
 * serves the whole namespace, so adding an operation costs a route entry
 * rather than a slot.
 *
 * ── Why the handlers still live in separate files ─────────────────────────
 * `api/_lib/handlers/*` are the same implementations as before, moved rather
 * than rewritten — the leading underscore tells Vercel they are shared code,
 * not entry points. They are pulled in with dynamic `import()` so a merge
 * request never loads the jsPDF and font machinery that only `generate` needs.
 * One fat module imported eagerly would put every dependency in every cold
 * start.
 *
 * ── Routes ────────────────────────────────────────────────────────────────
 *   POST /api/pdf/generate              text, HTML or Markdown to PDF
 *   POST /api/pdf/basic/merge           combine several PDFs
 *   POST /api/pdf/basic/split           extract page ranges
 *   POST /api/pdf/optimize/compress     reduce file size to a target
 *   POST /api/pdf/convert/to-pages      one single-page PDF per page
 *   POST /api/pdf/convert/from-images   images to a single PDF
 *   POST /api/pdf/fallback              anonymous, zero-retention path
 *   POST /api/pdf/upload                chunked upload, returns a `ref:` the
 *                                       operations above accept in place of
 *                                       inline base64
 *
 * The old flat paths (`/api/merge-pdf` and friends) still work: vercel.json
 * rewrites them here. They are not advertised, and they are not going away
 * without notice, because a public API that breaks its own URLs teaches
 * callers not to trust the next version either.
 */

/** Route key -> module under _lib/handlers. Adding an operation is one line. */
const ROUTES: Record<string, () => Promise<{ default: unknown }>> = {
  "generate": () => import("./_lib/handlers/generate.js"),
  "basic/merge": () => import("./_lib/handlers/merge.js"),
  "basic/split": () => import("./_lib/handlers/split.js"),
  "optimize/compress": () => import("./_lib/handlers/compress.js"),
  // Named for what it does. Tested against a real two-page PDF: it returns
  // `page_1.pdf`, `page_2.pdf` — one single-page PDF each, `output_format:
  // "pdf-per-page"`. It does not rasterise, because there is no canvas in the
  // Node runtime; the browser tool at /pdf-to-images does that with pdf.js.
  // `to-images` stays as an alias so existing callers keep working, but the
  // documented name is the one that does not promise a PNG.
  "convert/to-pages": () => import("./_lib/handlers/toImages.js"),
  "convert/to-images": () => import("./_lib/handlers/toImages.js"),
  "convert/from-images": () => import("./_lib/handlers/fromImages.js"),
  "fallback": () => import("./_lib/handlers/fallback.js"),
  // How anything bigger than Vercel's ~4.5 MB body cap gets in at all.
  "upload": () => import("./_lib/handlers/upload.js"),
};

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const key = operationFrom(req);

  const load = ROUTES[key];
  if (!load) {
    return fail(res, 404, "UNKNOWN_OPERATION", `No PDF operation at /api/pdf/${key}.`, {
      available: Object.keys(ROUTES).map((k) => `/api/pdf/${k}`),
    });
  }

  /*
   * Every successful PDF response carries a `storage` block saying whether the
   * file can be fetched again or must be saved now.
   *
   * Injected here rather than in each of the seven handlers: one envelope, one
   * place to change when an adapter lands, and no chance of a handler shipping
   * without the disclosure. Only 2xx JSON is touched — an error already tells
   * the caller what went wrong and does not need a retention notice.
   */
  const originalJson = res.json.bind(res);
  (res as VercelResponse).json = ((payload: unknown) => {
    const code = res.statusCode ?? 200;
    if (code >= 200 && code < 300 && payload && typeof payload === "object") {
      return originalJson({ ...(payload as Record<string, unknown>), storage: describeStorage() });
    }
    return originalJson(payload);
  }) as VercelResponse["json"];

  const mod = await load();
  return (mod.default as Handler)(req, res);
}
