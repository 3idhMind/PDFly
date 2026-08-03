/**
 * Secure cloud fallback.
 *
 * Used only when a job is too large for the visitor's device AND they have
 * explicitly consented. Files are processed in memory on the server and
 * returned immediately — nothing is stored, logged, or retained.
 */

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-fallback`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const CLOUD_MAX_BYTES = 40 * 1024 * 1024; // hard server-side cap

export type CloudOp = "merge" | "split" | "compress" | "images-to-pdf";

export interface CloudResultFile {
  name: string;
  blob: Blob;
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function runInCloud(
  op: CloudOp,
  files: File[],
  options: Record<string, unknown> = {},
): Promise<CloudResultFile[]> {
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > CLOUD_MAX_BYTES) {
    throw new Error(
      `Cloud processing is limited to ${CLOUD_MAX_BYTES / (1024 * 1024)} MB per job. Please split your files.`,
    );
  }

  const encoded = await Promise.all(
    files.map(async (f) => ({ name: f.name, type: f.type, data: await fileToBase64(f) })),
  );

  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ op, files: encoded, options }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Cloud processing failed (${res.status})`);
  }

  return (json.files as { name: string; data: string; type: string }[]).map((f) => ({
    name: f.name,
    blob: base64ToBlob(f.data, f.type || "application/pdf"),
  }));
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
