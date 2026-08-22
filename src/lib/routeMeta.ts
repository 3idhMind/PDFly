/**
 * Single source of truth for per-route SEO metadata.
 *
 * Read by two consumers that must never disagree:
 *   1. `scripts/postbuild.mjs` — bakes a real <title>/<meta>/<link rel=canonical>
 *      into a static HTML file per route, so a crawler sees actual content.
 *      Node strips the TypeScript types natively, which is why this file must
 *      stay plain TS: no JSX, no imports from anything React-shaped.
 *   2. The app itself, for anything that wants the same strings at runtime.
 *
 * WHY THIS EXISTS: before prerendering, every URL on the site returned a
 * byte-identical 6,275-byte SPA shell carrying the homepage's title. `/compress-pdf`
 * contained zero occurrences of the word "compress". There was, quite literally,
 * nothing on any page for Google to rank.
 *
 * Adding a route: add it here. The prerenderer and sitemap both pick it up with
 * no further edits — the previous sitemap was hand-maintained and stayed in sync
 * by luck rather than by construction.
 */

export interface RouteMeta {
  /** Path as served, no trailing slash. "/" for the homepage. */
  path: string;
  title: string;
  description: string;
  /** Sitemap priority, 0.0–1.0. */
  priority: number;
  changefreq: "daily" | "weekly" | "monthly";
  /** Excluded from the sitemap — private or no search value. Still prerendered. */
  noindex?: boolean;
}

export const SITE_ORIGIN = "https://pdfly.3idhmind.in";

/**
 * Titles are written for the query, not for the brand. The India tool pages
 * lead with the task a person actually types ("compress pdf to 200kb"), because
 * the target visitor arrives mid-task from a search result, not from a homepage.
 */
export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "PDFly — Free PDF Tools That Never Upload Your Files",
    description:
      "Merge, split, compress and convert PDFs entirely in your browser. Your files are never uploaded. Free, no signup, no watermark, open source.",
    priority: 1.0,
    changefreq: "weekly",
  },

  // ---------------------------------------------------------------- tools
  {
    path: "/merge-pdf",
    title: "Merge PDF Free — Combine PDF Files in Your Browser | PDFly",
    description:
      "Combine multiple PDFs into one, free and unlimited. Runs entirely in your browser — your files are never uploaded. No signup, no watermark.",
    priority: 0.9,
    changefreq: "monthly",
  },
  {
    path: "/split-pdf",
    title: "Split PDF Free — Extract Pages or Page Ranges | PDFly",
    description:
      "Split a PDF into separate files or pull out specific page ranges. 100% browser-based, nothing is uploaded. Free, no signup, no watermark.",
    priority: 0.9,
    changefreq: "monthly",
  },
  {
    path: "/compress-pdf",
    title: "Compress PDF to an Exact Size — Free, In Your Browser | PDFly",
    description:
      "Reduce PDF file size to an exact KB target. Picks the best quality that still fits, instead of crushing the file. Runs in your browser — no upload.",
    priority: 0.9,
    changefreq: "monthly",
  },
  // -------------------------------------------------- compress KB presets
  // Google India's autocomplete for "compress pdf to " orders as 200kb, 100kb,
  // 500kb, 1mb, 300kb, 50kb — a portal-upload audience, not an email-attachment
  // one. Each is its own prerendered page (not a query param) so it has its
  // own indexable title/H1. Component: src/pages/CompressPdf.tsx via presetKB prop.
  {
    path: "/compress-pdf-to-200kb",
    title: "Compress PDF to 200KB Free — Exact Size | PDFly",
    description:
      "Compress a PDF to exactly 200KB or under, right in your browser. Best quality that still fits the limit — no upload, no signup.",
    priority: 0.85,
    changefreq: "monthly",
  },
  {
    path: "/compress-pdf-to-100kb",
    title: "Compress PDF to 100KB Free — Exact Size | PDFly",
    description:
      "Compress a PDF to exactly 100KB or under, right in your browser. Best quality that still fits the limit — no upload, no signup.",
    priority: 0.85,
    changefreq: "monthly",
  },
  {
    path: "/compress-pdf-to-500kb",
    title: "Compress PDF to 500KB Free — Exact Size | PDFly",
    description:
      "Compress a PDF to exactly 500KB or under, right in your browser. Best quality that still fits the limit — no upload, no signup.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/compress-pdf-to-300kb",
    title: "Compress PDF to 300KB Free — Exact Size | PDFly",
    description:
      "Compress a PDF to exactly 300KB or under, right in your browser. Best quality that still fits the limit — no upload, no signup.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/compress-pdf-to-50kb",
    title: "Compress PDF to 50KB Free — Exact Size | PDFly",
    description:
      "Compress a PDF to exactly 50KB or under, right in your browser. Best quality that still fits the limit — no upload, no signup.",
    priority: 0.75,
    changefreq: "monthly",
  },
  {
    path: "/resize-image",
    title: "Resize Image to Exact KB — Photo & Signature | PDFly",
    description:
      "Resize a photo or signature to an exact KB target — 10KB to 200KB presets or any custom size. Runs in your browser, nothing uploaded.",
    priority: 0.85,
    changefreq: "monthly",
  },
  {
    path: "/compress-image-to-20kb",
    title: "Compress Image to 20KB Free — Photo Resizer | PDFly",
    description:
      "Compress a JPG, PNG or HEIC photo to exactly 20KB or under. Best quality that still fits the limit. Runs in your browser, nothing uploaded.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/resize-signature-to-10kb",
    title: "Resize Signature to 10KB Free — Online Tool | PDFly",
    description:
      "Resize a signature scan or photo to exactly 10KB or under, the size most application forms ask for. Runs in your browser, nothing uploaded.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/id-photo-crop",
    title: "Aadhaar/PAN Photo Crop for PVC Printing — Free, In Your Browser | PDFly",
    description:
      "Crop and resize a photo to exact Aadhaar, PAN, or Voter ID PVC card dimensions at 600 DPI. Centre-crop, exact pixel output, target file size. 100% browser-based, no upload.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/rotate-pdf",
    title: "Rotate PDF Free — Fix Page Orientation in Browser | PDFly",
    description:
      "Rotate PDF pages free online. Rotate every page or just the ones you pick, by 90, 180 or 270 degrees — 100% browser-based, no upload, no signup.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/delete-pdf-pages",
    title: "Delete PDF Pages Free — Remove Pages in Browser | PDFly",
    description:
      "Remove pages from a PDF free online. Pick the pages you don't want and delete them — 100% browser-based, no upload, no signup, no watermark.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/reorder-pdf-pages",
    title: "Reorder PDF Pages Free — Rearrange Pages in Browser | PDFly",
    description:
      "Rearrange the pages of a PDF free online. Move pages up or down into any order you want — 100% browser-based, no upload, no signup, no watermark.",
    priority: 0.8,
    changefreq: "monthly",
  },
  {
    path: "/exam/ssc-signature-size",
    title: "SSC CGL Signature Size 2026 (10-20KB) — Free Resizer | PDFly",
    description:
      "SSC CGL 2026 signature spec: 10-20KB JPEG. The notification gives two conflicting dimensions (6.0x2.0cm vs 4.0x2.0cm) — here's both, plus why CGL 2026 has no photo upload at all.",
    priority: 0.75,
    changefreq: "monthly",
  },
  {
    path: "/exam/upsc-photo-signature-size",
    title: "UPSC Photo & Signature Size (JPG, 20-200KB) — Free Resizer | PDFly",
    description:
      "UPSC portal specs: photo 20-200KB, signature 20-100KB at 350-500px, certificates 50-300KB PDF. These are minimums too — files can be rejected for being too small, not just too large.",
    priority: 0.75,
    changefreq: "monthly",
  },
  {
    path: "/pdf-to-images",
    title: "PDF to Image Free — Convert PDF Pages to PNG or JPG | PDFly",
    description:
      "Turn every page of a PDF into a PNG or JPG at your chosen DPI, downloaded as a zip. Rendered in your browser — your file never leaves the device.",
    priority: 0.9,
    changefreq: "monthly",
  },
  {
    path: "/images-to-pdf",
    title: "Image to PDF Free — JPG, PNG, HEIC & 25+ Formats | PDFly",
    description:
      "Combine photos into a single PDF. Supports JPG, PNG, WebP, HEIC from iPhone, TIFF and RAW. Converted in your browser, never uploaded.",
    priority: 0.9,
    changefreq: "monthly",
  },
  {
    path: "/app",
    title: "Text to PDF — 15 Templates, Free, No Signup | PDFly",
    description:
      "Turn plain text, HTML or Markdown into a clean PDF with 15 templates and 11 page sizes. Generated in your browser. Free, no watermark.",
    priority: 0.8,
    changefreq: "monthly",
  },

  // ------------------------------------------------------- feature pages
  {
    path: "/text-to-pdf",
    title: "Text to PDF Converter — Free Online, No Upload | PDFly",
    description:
      "Convert text, HTML or Markdown to a professional PDF free. 15 templates, 11 page sizes, batch generation. Runs client-side in your browser.",
    priority: 0.7,
    changefreq: "monthly",
  },
  {
    path: "/image-to-pdf",
    title: "Image to PDF Converter — 25+ Formats, Free | PDFly",
    description:
      "Convert JPG, PNG, HEIC, WebP, TIFF and RAW images into one PDF. Unlimited images, no signup, no watermark, nothing uploaded.",
    priority: 0.7,
    changefreq: "monthly",
  },
  {
    path: "/create",
    title: "Create a PDF — Pick a Tool | PDFly",
    description:
      "Every PDFly tool in one place: merge, split, compress, image to PDF, PDF to image and text to PDF. All free and all client-side.",
    priority: 0.6,
    changefreq: "monthly",
  },

  // -------------------------------------------------------------- content
  {
    path: "/blog",
    title: "PDFly Blog — PDF Generation, APIs & Document Tooling",
    description:
      "Practical guides on PDF generation, REST APIs, compression and document workflows. Written from what we actually shipped, not filler.",
    priority: 0.7,
    changefreq: "weekly",
  },
  {
    path: "/docs",
    title: "PDFly API Documentation — Free REST API for PDF Generation",
    description:
      "REST API reference for PDFly. Generate PDFs from text or HTML, convert images, merge and split. Free tier, examples in cURL, JS, Python, PHP and Go.",
    priority: 0.8,
    changefreq: "weekly",
  },
  {
    path: "/api-playground",
    title: "API Playground — Try the PDFly API Live | PDFly",
    description:
      "Run every PDFly API endpoint from the browser with prefilled samples. See the request, the response and the generated PDF side by side.",
    priority: 0.6,
    changefreq: "monthly",
  },
  {
    path: "/pricing",
    title: "Pricing — PDFly Is Free | PDFly",
    description:
      "Every PDFly web tool is free with no signup, no watermark and no limits. The REST API has a free tier. Paid plans are not available yet.",
    priority: 0.6,
    changefreq: "monthly",
  },
  {
    path: "/status",
    title: "System Status | PDFly",
    description: "Live status of PDFly's API, database and PDF engines.",
    priority: 0.3,
    changefreq: "daily",
  },

  // ---------------------------------------------------------------- legal
  {
    path: "/privacy",
    title: "Privacy Policy | PDFly",
    description:
      "What PDFly does and does not collect. Web tools run entirely in your browser and never upload your files — here is exactly how that works.",
    priority: 0.4,
    changefreq: "monthly",
  },
  {
    path: "/terms",
    title: "Terms of Service | PDFly",
    description: "The terms covering use of PDFly's web tools and REST API.",
    priority: 0.3,
    changefreq: "monthly",
  },

  // ------------------------------------- private: prerendered, not indexed
  // Must be listed even though it is private: the SPA catch-all rewrite is
  // gone (D-014), so a path with no prerendered file now genuinely 404s.
  // `noindex` keeps it out of the sitemap; the entry keeps the URL reachable.
  {
    path: "/admin",
    title: "Admin | PDFly",
    description: "Feedback inbox and blog management.",
    priority: 0.1,
    changefreq: "monthly",
    noindex: true,
  },
  {
    path: "/admin/security",
    title: "Admin · Security | PDFly",
    description: "Security event log.",
    priority: 0.1,
    changefreq: "monthly",
    noindex: true,
  },
  {
    path: "/settings",
    title: "API dashboard | PDFly",
    description: "Your API usage, keys and available downloads.",
    priority: 0.1,
    changefreq: "monthly",
    noindex: true,
  },
  {
    path: "/reset-password",
    title: "Reset Password | PDFly",
    description: "Set a new password for your PDFly account.",
    priority: 0.1,
    changefreq: "monthly",
    noindex: true,
  },
  {
    path: "/auth",
    title: "Sign In — PDFly by 3idhMinds",
    description:
      "Sign in to manage your PDFly API keys. The web PDF tools are free and need no account at all.",
    priority: 0.1,
    changefreq: "monthly",
    noindex: true,
  },
];

/** Routes that belong in sitemap.xml. */
export const indexableRoutes = (): RouteMeta[] => ROUTES.filter((r) => !r.noindex);

export const routeByPath = (path: string): RouteMeta | undefined =>
  ROUTES.find((r) => r.path === path);
