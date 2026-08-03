// PDFly JavaScript SDK — lightweight wrapper around the PDFly REST API.
//
// Usage:
//   import { PDFly } from "@/lib/sdk";
//   const pdfly = new PDFly({ apiKey: "pdfgen_..." });
//   const { pdfs } = await pdfly.textToPdf({ documents: [{ title, content }] });
//   const merged = await pdfly.mergePdf({ pdfs: [url1, url2] });

export interface PDFlyOptions {
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in ms. Default 120000 (2 min). */
  timeoutMs?: number;
  /** Automatic retries for 429 / 5xx / network errors. Default 2. */
  maxRetries?: number;
  /** Custom fetch implementation (e.g. node-fetch, undici). */
  fetch?: typeof fetch;
}

export interface TextDocument {
  title: string;
  content: string;
}

export interface TextToPdfInput {
  documents: TextDocument[];
  template?: string;
  language?: string;
  pageSize?: string;
}

export interface GeneratedPdf {
  title: string;
  url: string;
  sizeBytes: number;
}

// A PDF input may be either a base64 string (data URI or raw) or an https URL.
export type PdfInput = string;

export interface MergeInput { pdfs: PdfInput[] }
export interface SplitInput { pdf: PdfInput; ranges: string }
export interface CompressInput { pdf: PdfInput }
export interface PdfToImagesInput { pdf: PdfInput }

export interface MergeResult { url: string; size_bytes: number; pages_merged: number }
export interface SplitResultItem { name: string; url: string; size_bytes: number; pages: number }
export interface SplitResult { source_pages: number; pdfs: SplitResultItem[] }
export interface CompressResult {
  url: string; original_size_bytes: number; compressed_size_bytes: number;
  compression_ratio: number; savings_percent: number;
}
export interface PdfToImagesResult {
  output_format: string; page_count: number;
  pages: Array<{ page: number; url: string; size_bytes: number }>;
}

const DEFAULT_BASE = "https://pdfly.3idhmind.in/api";

/** Structured error thrown by every SDK call that fails. */
export class PDFlyError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(opts: { message: string; status: number; code: string; requestId?: string; retryAfter?: number }) {
    super(opts.message);
    this.name = "PDFlyError";
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.retryAfter = opts.retryAfter;
  }

  /** True when retrying the same request later may succeed. */
  get isRetryable() {
    return this.status === 429 || this.status >= 500 || this.status === 0;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PDFly {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private fetchImpl: typeof fetch;

  constructor(opts: PDFlyOptions) {
    if (!opts?.apiKey || typeof opts.apiKey !== "string") {
      throw new Error("PDFly: apiKey is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl?.replace(/\/$/, "") || DEFAULT_BASE;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.maxRetries = Math.max(0, opts.maxRetries ?? 2);
    const f = opts.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
    if (!f) throw new Error("PDFly: no fetch implementation available — pass one via options.fetch");
    this.fetchImpl = f.bind(globalThis);
  }

  private async once<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      throw new PDFlyError({
        status: 0,
        code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        message: aborted ? `Request timed out after ${this.timeoutMs}ms` : (err as Error).message,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }

    if (!res.ok) {
      throw new PDFlyError({
        status: res.status,
        code: json?.error ?? `HTTP_${res.status}`,
        message: json?.message ?? text ?? res.statusText,
        requestId: res.headers.get("x-request-id") ?? undefined,
        retryAfter: Number(json?.retry_after ?? json?.retry_after_seconds ?? res.headers.get("retry-after")) || undefined,
      });
    }
    return json as T;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    let lastErr: PDFlyError | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.once<T>(path, body);
      } catch (err) {
        const e = err as PDFlyError;
        lastErr = e;
        if (!(e instanceof PDFlyError) || !e.isRetryable || attempt === this.maxRetries) throw e;
        const wait = e.retryAfter ? e.retryAfter * 1000 : Math.min(8000, 500 * 2 ** attempt);
        await sleep(wait);
      }
    }
    throw lastErr!;
  }

  textToPdf(input: TextToPdfInput): Promise<{ pdfs: GeneratedPdf[] }> {
    if (!input?.documents?.length) throw new Error("PDFly: 'documents' must contain at least one item");
    return this.request("/generate-pdf", input);
  }
  batchGenerate(input: TextToPdfInput): Promise<{ pdfs: GeneratedPdf[] }> {
    if (!input?.documents?.length) throw new Error("PDFly: 'documents' must contain at least one item");
    return this.request("/generate-pdf", input);
  }
  mergePdf(input: MergeInput): Promise<MergeResult> {
    if (!Array.isArray(input?.pdfs) || input.pdfs.length < 2) {
      throw new Error("PDFly: 'pdfs' must contain at least 2 items");
    }
    return this.request("/merge-pdf", input);
  }
  splitPdf(input: SplitInput): Promise<SplitResult> {
    if (!input?.pdf || !input?.ranges) throw new Error("PDFly: 'pdf' and 'ranges' are required");
    return this.request("/split-pdf", input);
  }
  compressPdf(input: CompressInput): Promise<CompressResult> {
    if (!input?.pdf) throw new Error("PDFly: 'pdf' is required");
    return this.request("/compress-pdf", input);
  }
  pdfToImages(input: PdfToImagesInput): Promise<PdfToImagesResult> {
    if (!input?.pdf) throw new Error("PDFly: 'pdf' is required");
    return this.request("/pdf-to-images", input);
  }
}

export default PDFly;
