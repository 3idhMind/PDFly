/**
 * The API, described once.
 *
 * ── Why a registry instead of hand-written page markup ────────────────────
 * The docs have been wrong three separate times: they promised a `url` field
 * no endpoint returned, they showed `expires_in_seconds` that never existed,
 * and they called an endpoint "PDF to Images" when it returns single-page
 * PDFs. Every one of those was a hand-written block that drifted from the
 * handler and nothing could tell.
 *
 * Describing each endpoint as data means the page renders from one place, a
 * new endpoint is one entry rather than a copy-pasted section, and the
 * navigation, the search index and the examples cannot disagree with each
 * other because they are generated from the same object.
 *
 * ── Accuracy rule ─────────────────────────────────────────────────────────
 * Every field below was read from the handler in `api/_lib/handlers/` or
 * captured from a live production call on 2026-08-14. If you add an endpoint,
 * call it first and paste what actually came back. Do not describe intent.
 */

export type Method = "GET" | "POST" | "PUT" | "DELETE";
export type Auth = "none" | "key-or-token" | "token-only" | "admin";

export interface Field {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}

export interface Endpoint {
  id: string;
  group: string;
  name: string;
  method: Method;
  path: string;
  /** Older flat path kept working by a vercel.json rewrite. */
  legacyPath?: string;
  auth: Auth;
  summary: string;
  /** Anything a caller would otherwise discover the hard way. */
  note?: string;
  request?: Field[];
  response: Field[];
  /** Real example body. Kept small enough to read. */
  exampleBody?: Record<string, unknown>;
  /** Consumes the monthly document quota. */
  costsQuota?: boolean;
}

export const BASE_URL = "https://pdfly.3idhmind.in";

export const AUTH_LABEL: Record<Auth, string> = {
  none: "Public",
  "key-or-token": "API key or signed-in session",
  "token-only": "Signed-in session only",
  admin: "Admin account only",
};

/** Fields present on every successful PDF response. Documented once. */
export const STORAGE_BLOCK: Field[] = [
  { name: "storage.persisted", type: "boolean", desc: "Whether the file can be fetched again after this response." },
  { name: "storage.message", type: "string", desc: "Plain-language sentence to show the user. Says whether they must save the file now." },
  { name: "storage.expires_at", type: "string | null", desc: "ISO timestamp the stored copy is deleted. Null when nothing was stored." },
  { name: "storage.retention_seconds", type: "number | null", desc: "How long the stored copy lives. 3600 when storage is on." },
  { name: "storage.download_url", type: "string?", desc: "Present only when storage is on. A link on pdfly.3idhmind.in, never on the storage provider. Expires with the file." },
];

export const ENDPOINTS: Endpoint[] = [
  /* ------------------------------------------------------------- generate */
  {
    id: "generate",
    group: "Generate",
    name: "Text or HTML to PDF",
    method: "POST",
    path: "/api/pdf/generate",
    legacyPath: "/api/generate-pdf",
    auth: "key-or-token",
    costsQuota: true,
    summary: "Turns text, HTML or Markdown into a PDF. Up to 5 documents per request.",
    note: "Latin, Devanagari (Hindi, Marathi, Sanskrit, Nepali) and Arabic script (Arabic, Persian, Urdu) render correctly. The matching Noto font is embedded automatically when the content needs it. Arabic renders with correct glyphs but without bidirectional reordering, so letters appear in separated forms. Chinese, Japanese, Korean, Hebrew and Thai are NOT supported and produce a warning in the response rather than silently broken output.",
    request: [
      { name: "documents", type: "array", required: true, desc: "1 to 5 documents. Each needs title and content." },
      { name: "documents[].title", type: "string", required: true, desc: "Becomes the filename." },
      { name: "documents[].content", type: "string", required: true, desc: "Plain text, HTML or Markdown." },
      { name: "template", type: "string", desc: "One of 15 templates. Defaults to professional." },
      { name: "pageSize", type: "string", desc: "A4, Letter and 9 others. Defaults to A4." },
    ],
    response: [
      { name: "success", type: "boolean", desc: "True when every document rendered." },
      { name: "api_version", type: "string", desc: 'Currently "v1".' },
      { name: "documents[].document_id", type: "string", desc: "UUID for this document." },
      { name: "documents[].title", type: "string", desc: "Filename, with .pdf appended." },
      { name: "documents[].size_bytes", type: "number", desc: "Size of the decoded PDF." },
      { name: "documents[].pdf_base64", type: "string", desc: "The PDF itself, base64, no data: prefix. Decode and write to disk." },
      { name: "documents[].download_url", type: "string?", desc: "Present only when storage is on." },
      { name: "warnings", type: "string[]?", desc: "Present when something degraded, e.g. an unsupported script, or a font that could not be fetched. Always worth surfacing to the user." },
    ],
    exampleBody: {
      documents: [{ title: "Invoice 042", content: "<h1>Invoice</h1><p>Amount due: 4,500</p>" }],
      template: "professional",
    },
  },

  /* ---------------------------------------------------------------- basic */
  {
    id: "merge",
    group: "Basic",
    name: "Merge PDFs",
    method: "POST",
    path: "/api/pdf/basic/merge",
    legacyPath: "/api/merge-pdf",
    auth: "key-or-token",
    costsQuota: true,
    summary: "Combines several PDFs into one, in the order given.",
    request: [
      { name: "pdfs", type: "string[]", required: true, desc: "At least 2 items. Each is base64 or an https URL." },
    ],
    response: [
      { name: "success", type: "boolean", desc: "" },
      { name: "filename", type: "string", desc: 'Always "merged.pdf".' },
      { name: "content_type", type: "string", desc: "application/pdf" },
      { name: "pdf_base64", type: "string", desc: "The merged PDF, base64." },
      { name: "size_bytes", type: "number", desc: "" },
      { name: "pages_merged", type: "number", desc: "Total pages in the result." },
      { name: "inputs", type: "number", desc: "How many files were combined." },
      { name: "processing_time_ms", type: "number", desc: "" },
    ],
    exampleBody: { pdfs: ["JVBERi0xLjQK...", "https://example.com/second.pdf"] },
  },
  {
    id: "split",
    group: "Basic",
    name: "Split a PDF",
    method: "POST",
    path: "/api/pdf/basic/split",
    legacyPath: "/api/split-pdf",
    auth: "key-or-token",
    costsQuota: true,
    summary: "Extracts page ranges into separate PDFs.",
    note: "`ranges` is required. Omitting it returns a 400, not the whole document.",
    request: [
      { name: "pdf", type: "string", required: true, desc: "Base64 or an https URL." },
      { name: "ranges", type: "string", required: true, desc: 'Comma-separated, e.g. "1-3,5,7-9".' },
    ],
    response: [
      { name: "success", type: "boolean", desc: "" },
      { name: "source_pages", type: "number", desc: "Page count of the input." },
      { name: "pdfs[].name", type: "string", desc: 'e.g. "split_p1-3.pdf".' },
      { name: "pdfs[].data", type: "string", desc: "Base64 PDF. Note this is `data`, not `pdf_base64`." },
      { name: "pdfs[].size_bytes", type: "number", desc: "" },
      { name: "pdfs[].pages", type: "number", desc: "Pages in this part." },
      { name: "processing_time_ms", type: "number", desc: "" },
    ],
    exampleBody: { pdf: "JVBERi0xLjQK...", ranges: "1-3,5" },
  },

  /* ------------------------------------------------------------- optimize */
  {
    id: "compress",
    group: "Optimise",
    name: "Compress a PDF",
    method: "POST",
    path: "/api/pdf/optimize/compress",
    legacyPath: "/api/compress-pdf",
    auth: "key-or-token",
    costsQuota: true,
    summary: "Reduces file size, optionally towards a target.",
    note: "How much this achieves depends entirely on the document. A text PDF has metadata and duplicate resources to strip. A scan is already JPEG-compressed, so expect single-digit percentages. `savings_percent` can be negative on a file that is already minimal.",
    request: [
      { name: "pdf", type: "string", required: true, desc: "Base64 or an https URL." },
      { name: "targetBytes", type: "number", desc: "Aim for this size. Best effort, never at the cost of legibility." },
    ],
    response: [
      { name: "success", type: "boolean", desc: "" },
      { name: "name", type: "string", desc: "" },
      { name: "data", type: "string", desc: "Base64 PDF. Note `data`, not `pdf_base64`." },
      { name: "original_size_bytes", type: "number", desc: "" },
      { name: "compressed_size_bytes", type: "number", desc: "" },
      { name: "compression_ratio", type: "number", desc: "compressed / original." },
      { name: "savings_percent", type: "number", desc: "Can be negative." },
      { name: "notes", type: "object", desc: "mode, target_bytes, target_met." },
    ],
    exampleBody: { pdf: "JVBERi0xLjQK...", targetBytes: 200000 },
  },

  /* -------------------------------------------------------------- convert */
  {
    id: "to-pages",
    group: "Convert",
    name: "PDF to single-page PDFs",
    method: "POST",
    path: "/api/pdf/convert/to-pages",
    legacyPath: "/api/pdf-to-images",
    auth: "key-or-token",
    costsQuota: true,
    summary: "Splits a document into one PDF per page.",
    note: "This returns PDFs, not PNG or JPEG, and `output_format` says so. Rasterising needs a canvas and there is none in the server runtime. For real images use the browser tool at /pdf-to-images, which does it with pdf.js. The old name `convert/to-images` still works and reaches the same handler.",
    request: [{ name: "pdf", type: "string", required: true, desc: "Base64 or an https URL." }],
    response: [
      { name: "success", type: "boolean", desc: "" },
      { name: "output_format", type: "string", desc: '"pdf-per-page".' },
      { name: "note", type: "string", desc: "Restates that these are PDFs." },
      { name: "page_count", type: "number", desc: "" },
      { name: "pages[].page", type: "number", desc: "1-indexed." },
      { name: "pages[].filename", type: "string", desc: 'e.g. "page_1.pdf".' },
      { name: "pages[].data", type: "string", desc: "Base64 single-page PDF." },
      { name: "pages[].size_bytes", type: "number", desc: "" },
    ],
    exampleBody: { pdf: "JVBERi0xLjQK..." },
  },
  {
    id: "from-images",
    group: "Convert",
    name: "Images to PDF",
    method: "POST",
    path: "/api/pdf/convert/from-images",
    legacyPath: "/api/images-to-pdf",
    auth: "key-or-token",
    costsQuota: true,
    summary: "Combines images into one PDF, one image per page.",
    request: [
      { name: "images", type: "string[]", required: true, desc: "Base64 or https URLs. JPEG and PNG." },
      { name: "page_size", type: "string", desc: "Defaults to A4." },
      { name: "orientation", type: "string", desc: "portrait or landscape." },
      { name: "fit_mode", type: "string", desc: "How each image fills its page." },
    ],
    response: [
      { name: "success", type: "boolean", desc: "" },
      { name: "filename", type: "string", desc: 'Always "images.pdf".' },
      { name: "pdf_base64", type: "string", desc: "The PDF, base64." },
      { name: "size_bytes", type: "number", desc: "" },
      { name: "pages", type: "number", desc: "" },
      { name: "images", type: "number", desc: "How many were accepted." },
    ],
    exampleBody: { images: ["iVBORw0KGgo...", "https://example.com/photo.jpg"] },
  },

  /* -------------------------------------------------------------- account */
  {
    id: "me",
    group: "Account",
    name: "Who am I",
    method: "GET",
    path: "/api/account/me",
    legacyPath: "/api/me",
    auth: "key-or-token",
    summary: "Identity of the caller, and whether this is the admin account.",
    response: [
      { name: "uid", type: "string", desc: "Firebase user ID of the key owner." },
      { name: "authType", type: "string", desc: '"apiKey" or "idToken".' },
      { name: "isAdmin", type: "boolean", desc: "Always false for an API key. Admin routes resolve the owner separately." },
    ],
  },
  {
    id: "keys",
    group: "Account",
    name: "Manage API keys",
    method: "GET",
    path: "/api/account/keys",
    legacyPath: "/api/keys",
    auth: "token-only",
    summary: "List, create and revoke keys. POST returns the raw key exactly once.",
    note: "An API key cannot manage API keys. Otherwise one leaked key becomes permanent self-renewing access and revoking the original would not help. Sign in through the site instead.",
    response: [
      { name: "keys[].keyId", type: "string", desc: "Use this to revoke." },
      { name: "keys[].name", type: "string", desc: "" },
      { name: "keys[].keyPrefix", type: "string", desc: "First few characters, for identification." },
      { name: "keys[].active", type: "boolean", desc: "" },
      { name: "keys[].rateLimitPerMin", type: "number", desc: "" },
      { name: "keys[].createdAt", type: "string | null", desc: "ISO." },
      { name: "keys[].lastUsedAt", type: "string | null", desc: "ISO." },
    ],
  },

  /* ----------------------------------------------------------------- blog */
  {
    id: "blog-read",
    group: "Blog",
    name: "Read posts",
    method: "GET",
    path: "/api/blog",
    auth: "none",
    summary: "Published posts, newest first. Add ?slug= for one post.",
    note: "Public and unauthenticated on purpose: the build calls it to prerender one static HTML file per post. Scheduled posts stay hidden until their publishAt date.",
    response: [
      { name: "posts[].slug", type: "string", desc: "URL segment." },
      { name: "posts[].title", type: "string", desc: "" },
      { name: "posts[].excerpt", type: "string", desc: "" },
      { name: "posts[].content", type: "string", desc: "Markdown body." },
      { name: "posts[].category", type: "string", desc: "One of six fixed categories." },
      { name: "posts[].tags", type: "string[]", desc: "" },
      { name: "posts[].publishAt", type: "string", desc: "ISO. Future dates are hidden." },
      { name: "count", type: "number", desc: "" },
    ],
  },
  {
    id: "blog-write",
    group: "Blog",
    name: "Publish, update, delete a post",
    method: "POST",
    path: "/api/blog",
    auth: "admin",
    summary: "POST creates, PUT updates, DELETE removes. All need the admin account.",
    note: "One API, not two. There is no separate blog key: any key belonging to the admin account may publish, and a key from any other account may not. The em dash and several machine-written stock phrases are rejected with a 400 rather than stripped silently, so the habit has to be fixed rather than hidden.",
    request: [
      { name: "slug", type: "string", required: true, desc: "Lowercase with hyphens. Becomes the URL." },
      { name: "title", type: "string", required: true, desc: "" },
      { name: "excerpt", type: "string", required: true, desc: "Shown on the index and in search results." },
      { name: "content", type: "string", required: true, desc: "Markdown." },
      { name: "category", type: "string", required: true, desc: "Exam Guides, Government IDs, PDF Tools, Image Tools, API & Developers, Product Updates." },
      { name: "publishAt", type: "string", desc: "ISO. A future date schedules the post." },
    ],
    response: [
      { name: "slug", type: "string", desc: "" },
      { name: "url", type: "string", desc: "Path the post will live at." },
      { name: "created", type: "boolean", desc: "False when an existing post was updated." },
      { name: "note", type: "string", desc: "Reminds you a rebuild is needed to publish." },
    ],
    exampleBody: {
      slug: "resize-signature-for-ssc",
      title: "Resizing a signature for SSC uploads",
      excerpt: "What the portal actually checks.",
      content: "## The short answer\\n\\nBetween 10KB and 20KB, JPEG.",
      category: "Exam Guides",
    },
  },

  /* --------------------------------------------------------------- system */
  {
    id: "health",
    group: "System",
    name: "Health probe",
    method: "GET",
    path: "/api/system",
    legacyPath: "/api/health",
    auth: "none",
    summary: "Whether the API and its dependencies are answering.",
    note: "Always returns 200. The verdict is in the body, because a status endpoint that 500s cannot tell you the difference between down and unreachable.",
    response: [
      { name: "status", type: "string", desc: '"operational" or "degraded".' },
      { name: "services[].name", type: "string", desc: "api, database, authentication." },
      { name: "services[].ok", type: "boolean", desc: "" },
      { name: "services[].latencyMs", type: "number", desc: "" },
      { name: "checkedAt", type: "string", desc: "ISO." },
    ],
  },
  {
    id: "upload",
    group: "System",
    name: "Chunked upload",
    method: "POST",
    path: "/api/pdf/upload",
    auth: "key-or-token",
    summary: "Sends a file larger than the request-body cap, in parts, and returns a ref the PDF operations accept.",
    note: "Vercel refuses a request body over ~4.5 MB before our code runs, so a bigger file cannot be sent inline at all. Call this once per 3 MB part with action \"part\", then once with action \"complete\". The returned `ref:` string goes wherever an endpoint takes base64 or an https URL — for example { \"pdfs\": [\"ref:…\", \"ref:…\"] } on merge. Refs are signed, scoped to the caller and expire in an hour. Authentication is optional: without it you get the anonymous rate limit, which is what the browser fallback uses.",
    request: [
      { name: "action", type: "string", required: true, desc: '"part" or "complete".' },
      { name: "uploadId", type: "string", required: true, desc: "8-64 chars of A-Z, a-z, 0-9, _ or -. You choose it; keep it the same across every call for one file." },
      { name: "total", type: "number", required: true, desc: "How many parts the file is split into." },
      { name: "index", type: "number", desc: 'action "part" only. Zero-based.' },
      { name: "data", type: "string", desc: 'action "part" only. Base64 of at most 3 MB of raw bytes.' },
      { name: "filename", type: "string", desc: 'action "complete" only. Used for the download name.' },
    ],
    response: [
      { name: "ref", type: "string", desc: 'action "complete" only. Pass this wherever a PDF input is accepted.' },
      { name: "size_bytes", type: "number", desc: "Size of the assembled file." },
      { name: "expires_at", type: "string", desc: "ISO timestamp the ref stops resolving." },
      { name: "received", type: "number", desc: 'action "part" only. The index that was stored.' },
    ],
    exampleBody: { action: "complete", uploadId: "a1b2c3d4e5f6", total: 4, filename: "contract.pdf" },
  },
  {
    id: "file",
    group: "System",
    name: "Download a stored file",
    method: "GET",
    path: "/api/file/{token}",
    auth: "none",
    summary: "Returns a file that was stored by an earlier request.",
    note: "The token is signed and carries its own expiry, so the link works without a header and stops working on its own. It is a bearer credential: anyone holding it can download that one file until it expires. Invalid, tampered and expired tokens all answer 404, so probing cannot tell them apart.",
    response: [
      { name: "(body)", type: "binary", desc: "The file, with Content-Disposition: attachment." },
      { name: "X-Expires-At", type: "header", desc: "ISO timestamp the link dies." },
    ],
  },
];

export const GROUPS = ["Generate", "Basic", "Optimise", "Convert", "Account", "Blog", "System"] as const;

/** Real platform limits, not policy. Stated so nobody discovers them at 3am. */
export const LIMITS = [
  { label: "Input per job", value: "10 MB", note: "Free tier, across every file in one request. Growth raises it to 1 GB; past that, talk to us." },
  { label: "Single request body", value: "~4.5 MB", note: "Vercel's cap, applied before our code runs. Base64 adds about a third. Use /api/pdf/upload to send anything larger — it splits the file into parts and hands back a ref." },
  { label: "Inline response", value: "3 MB", note: "Results larger than this come back as a signed download_url instead of base64. Downloads themselves are streamed and have no cap." },
  { label: "Documents per month", value: "100", note: "Free tier. Resets on the first of the month." },
  { label: "Requests per minute", value: "60", note: "Per key. Exceeding it returns 429." },
  { label: "Documents per request", value: "5", note: "Applies to /api/pdf/generate." },
  { label: "API keys per account", value: "10", note: "Revoke one to create another." },
  { label: "Stored file retention", value: "1 hour", note: "After that the link 404s and the object is deleted." },
];

/** Error codes a caller should handle, taken from api/_lib/http.ts and the handlers. */
export const ERRORS = [
  { status: 400, code: "INVALID_INPUT", meaning: "A required field is missing or malformed. The message names it." },
  { status: 400, code: "INVALID_POST", meaning: "Blog only. The `errors` array lists every reason, including banned phrasing." },
  { status: 401, code: "UNAUTHENTICATED", meaning: "No Authorization header, or it is not `Bearer <token>`." },
  { status: 401, code: "INVALID_KEY", meaning: "The key does not exist or was revoked. Deliberately the same message for both." },
  { status: 401, code: "INVALID_TOKEN", meaning: "A signed-in session expired. Sign in again." },
  { status: 403, code: "FORBIDDEN", meaning: "Authenticated, but not allowed to do this. Managing keys with a key, or publishing without the admin account." },
  { status: 404, code: "UNKNOWN_OPERATION", meaning: "No such endpoint under this namespace. The response lists the valid ones." },
  { status: 405, code: "METHOD_NOT_ALLOWED", meaning: "Right path, wrong verb." },
  { status: 429, code: "LIMIT_EXCEEDED", meaning: "Rate limit or monthly quota. Nothing was charged and nothing was silently dropped." },
  { status: 500, code: "INTERNAL_ERROR", meaning: "Our fault. The message never echoes your request." },
];
