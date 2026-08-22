/**
 * Secure cloud fallback.
 *
 * Used only when a job is too large for the visitor's device AND they have
 * explicitly consented. The file is processed on our own API and the result is
 * handed straight back; nothing is kept beyond the one-hour retention window
 * that applies to every API-generated file.
 *
 * ── Why this no longer talks to Supabase ──────────────────────────────────
 * It used to POST the whole job, base64-encoded, to a Supabase edge function.
 * That function was still live long after the rest of Supabase was removed from
 * the project, which meant the one path that handles a visitor's real document
 * ran on infrastructure nobody was maintaining, from source no longer in this
 * repository, on 256 MB of memory and a two-second CPU budget. It now runs on
 * the same Vercel functions as the public API: 2 GB and five minutes.
 *
 * ── Why the upload is chunked ─────────────────────────────────────────────
 * Vercel refuses a request body over ~4.5 MB before any of our code runs, and
 * base64 adds a third on top. Files therefore go up in 3 MB parts to
 * /api/pdf/upload, which stitches them in object storage and returns a signed
 * `ref:` that the processing endpoints resolve server-side. See
 * api/_lib/handlers/upload.ts for the other half.
 */

import { getIdToken } from "@/lib/firebase/auth";

/** Must match CHUNK_BYTES in api/_lib/handlers/upload.ts. */
const CHUNK_BYTES = 3 * 1024 * 1024;

/** Free-tier ceiling. Mirrors TIERS.free.maxJobBytes in api/_lib/tiers.ts. */
export const CLOUD_MAX_BYTES = 10 * 1024 * 1024;

export type CloudOp = "merge" | "split" | "compress" | "images-to-pdf";

export interface CloudResultFile {
  name: string;
  blob: Blob;
}

const ENDPOINTS: Record<CloudOp, string> = {
  merge: "/api/pdf/basic/merge",
  split: "/api/pdf/basic/split",
  compress: "/api/pdf/optimize/compress",
  "images-to-pdf": "/api/pdf/convert/from-images",
};

/* ------------------------------------------------------------------ helpers */

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Signed-in visitors get their own account's limits; everyone else falls
  // through to the anonymous, IP-limited path rather than being turned away.
  const token = await getIdToken().catch(() => null);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Cloud processing failed (${res.status})`);
  }
  return json as T;
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked so a multi-megabyte part cannot blow the argument limit on
  // String.fromCharCode, which is what a naive spread does at about 100 KB.
  let binary = "";
  const STEP = 32 * 1024;
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function randomId(): string {
  const raw = new Uint8Array(12);
  crypto.getRandomValues(raw);
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uploads one file in parts and returns the `ref:` the API accepts. */
async function uploadFile(file: File | Blob, filename: string): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const total = Math.max(1, Math.ceil(buffer.length / CHUNK_BYTES));
  const uploadId = randomId();

  for (let index = 0; index < total; index++) {
    const slice = buffer.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
    await postJson("/api/pdf/upload", {
      action: "part",
      uploadId,
      index,
      total,
      data: bytesToBase64(slice),
    });
  }

  const done = await postJson<{ ref: string }>("/api/pdf/upload", {
    action: "complete",
    uploadId,
    total,
    filename,
  });
  return done.ref;
}

/** One output item, however the API chose to return it. */
interface DeliveredItem {
  name?: string;
  filename?: string;
  data?: string;
  pdf_base64?: string;
  download_url?: string;
}

async function toResultFile(item: DeliveredItem, fallbackName: string): Promise<CloudResultFile> {
  const name = item.filename || item.name || fallbackName;
  const inline = item.pdf_base64 ?? item.data;
  if (inline) return { name, blob: base64ToBlob(inline, "application/pdf") };

  if (item.download_url) {
    // Large results come back as a signed link on our own domain rather than
    // inline, because the response body has the same 4.5 MB cap the request does.
    const res = await fetch(item.download_url);
    if (!res.ok) throw new Error("The processed file could not be downloaded.");
    return { name, blob: await res.blob() };
  }

  throw new Error("The server returned no file.");
}

/* ----------------------------------------------------------- anonymous run */

/**
 * Vercel refuses a request body over ~4.5 MB, and base64 costs a third on top,
 * so an anonymous inline job cannot exceed about 3.3 MB however it is framed.
 * Stated as a real number with a real way out rather than letting the platform
 * answer with a 413 the user cannot interpret.
 */
export const ANON_MAX_BYTES = 3 * 1024 * 1024;

async function runAnonymous(
  op: CloudOp,
  files: File[],
  options: Record<string, unknown>,
  total: number,
): Promise<CloudResultFile[]> {
  if (total > ANON_MAX_BYTES) {
    throw new Error(
      `Without an account, cloud processing is limited to ${ANON_MAX_BYTES / (1024 * 1024)} MB per job. ` +
        `Sign in to raise it to ${CLOUD_MAX_BYTES / (1024 * 1024)} MB, or split your files.`,
    );
  }

  const encoded = await Promise.all(
    files.map(async (f) => ({
      name: f.name,
      type: f.type,
      data: bytesToBase64(new Uint8Array(await f.arrayBuffer())),
    })),
  );

  const out = await postJson<{ files?: { name: string; data: string; type?: string }[] }>(
    "/api/pdf/fallback",
    { op, files: encoded, options },
  );

  return (out.files ?? []).map((f) => ({
    name: f.name,
    blob: base64ToBlob(f.data, f.type || "application/pdf"),
  }));
}

/* --------------------------------------------------------------------- run */

export async function runInCloud(
  op: CloudOp,
  files: File[],
  options: Record<string, unknown> = {},
): Promise<CloudResultFile[]> {
  const total = files.reduce((s, f) => s + f.size, 0);
  const token = await getIdToken().catch(() => null);

  /*
   * Signed-out visitors take a different route, and it is not an optimisation.
   *
   * The chunked path parks the file in object storage so it can get past the
   * request-body cap, and the operations that resolve a `ref:` all require a
   * credential — an anonymous caller gets a 401 from every one of them. The
   * anonymous route is /api/pdf/fallback, which is deliberately authless and
   * deliberately zero-retention: it holds nothing, writes nothing and returns
   * the result in the same response. That contract is the reason it can run
   * without an account at all, and it is also why it cannot accept a stored
   * ref. So anonymous jobs stay inline, and are bounded by what one request
   * body can carry rather than by the tier ceiling.
   */
  if (!token) return runAnonymous(op, files, options, total);

  if (total > CLOUD_MAX_BYTES) {
    throw new Error(
      `Cloud processing is limited to ${CLOUD_MAX_BYTES / (1024 * 1024)} MB per job. ` +
        "Split your files, or contact us about a larger plan.",
    );
  }

  const refs = await Promise.all(
    files.map((f, i) => uploadFile(f, f.name || `input_${i + 1}.pdf`)),
  );

  if (op === "merge") {
    const out = await postJson<DeliveredItem>(ENDPOINTS.merge, { pdfs: refs, ...options });
    return [await toResultFile(out, "merged.pdf")];
  }

  if (op === "compress") {
    const out = await postJson<DeliveredItem>(ENDPOINTS.compress, { pdf: refs[0], ...options });
    return [await toResultFile(out, "compressed.pdf")];
  }

  if (op === "images-to-pdf") {
    const out = await postJson<DeliveredItem>(ENDPOINTS["images-to-pdf"], { images: refs, ...options });
    return [await toResultFile(out, "images.pdf")];
  }

  const out = await postJson<{ pdfs: DeliveredItem[] }>(ENDPOINTS.split, { pdf: refs[0], ...options });
  return Promise.all((out.pdfs ?? []).map((p, i) => toResultFile(p, `split_${i + 1}.pdf`)));
}

/**
 * Runs a job locally, and — only with consent — retries on the cloud if the
 * local attempt fails (out of memory, crash, etc.).
 */
export async function withCloudFallback<T>(opts: {
  local: () => Promise<T>;
  cloud: () => Promise<T>;
  allowCloud: boolean;
  skipLocal?: boolean;
  onFallback?: () => void;
}): Promise<{ result: T; usedCloud: boolean }> {
  if (!opts.skipLocal) {
    try {
      return { result: await opts.local(), usedCloud: false };
    } catch (err) {
      if (!opts.allowCloud) throw err;
      opts.onFallback?.();
    }
  } else {
    if (!opts.allowCloud) throw new Error("This job is too large for your device.");
    opts.onFallback?.();
  }
  return { result: await opts.cloud(), usedCloud: true };
}
