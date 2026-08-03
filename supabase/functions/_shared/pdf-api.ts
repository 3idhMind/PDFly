// Shared helpers for PDFly tool APIs (merge/split/compress/pdf-to-images).
// Keeps auth, storage upload, and logging consistent across endpoints.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB per input PDF
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB total per request
export const MAX_INPUTS = 30; // max PDF inputs per request
export const MAX_BODY_BYTES = 70 * 1024 * 1024; // hard body cap (base64 overhead)
export const DEFAULT_RATE_LIMIT_PER_MIN = 60;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export function assertLooksLikePdf(bytes: Uint8Array, label = "pdf") {
  // Some producers emit leading whitespace/BOM before %PDF-.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (
      head[i] === PDF_MAGIC[0] && head[i + 1] === PDF_MAGIC[1] &&
      head[i + 2] === PDF_MAGIC[2] && head[i + 3] === PDF_MAGIC[3]
    ) return;
  }
  throw new Error(`${label}: not a valid PDF file`);
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/** Reject oversized requests before the body is ever read. */
export function assertBodySize(req: Request): Response | null {
  const len = req.headers.get("content-length");
  if (len && Number(len) > MAX_BODY_BYTES) {
    return jsonResponse(413, {
      error: "PAYLOAD_TOO_LARGE",
      message: `Request body exceeds ${Math.round(MAX_BODY_BYTES / (1024 * 1024))}MB.`,
    });
  }
  return null;
}

/** Writes a request trace row. Never throws. */
export async function logRequest(
  admin: SupabaseClient,
  entry: {
    requestId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    ip?: string;
    userId?: string | null;
    apiKeyId?: string | null;
    error?: string | null;
  },
) {
  try {
    await admin.from("api_request_logs").insert({
      request_id: entry.requestId,
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.statusCode,
      latency_ms: entry.latencyMs,
      ip_address: entry.ip ?? null,
      user_id: entry.userId ?? null,
      api_key_id: entry.apiKeyId ?? null,
      error: entry.error ?? null,
    });
  } catch (e) {
    console.error("logRequest failed:", e);
  }
}

/** Writes a security event row. Never throws. */
export async function logSecurityEvent(
  admin: SupabaseClient,
  entry: {
    eventType: string;
    severity?: "info" | "warning" | "critical";
    userId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    details?: Record<string, unknown>;
  },
) {
  try {
    await admin.from("security_events").insert({
      event_type: entry.eventType,
      severity: entry.severity ?? "info",
      user_id: entry.userId ?? null,
      ip_address: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
      details: entry.details ?? {},
    });
  } catch (e) {
    console.error("logSecurityEvent failed:", e);
  }
}

/**
 * Table-backed fixed-window rate limiter (1 minute windows).
 * Returns a 429 response when the caller is over budget.
 */
export async function enforceRateLimit(
  admin: SupabaseClient,
  subject: string,
  endpoint: string,
  limitPerMin = DEFAULT_RATE_LIMIT_PER_MIN,
): Promise<Response | null> {
  try {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
    const { data: existing } = await admin
      .from("rate_limits")
      .select("id, count")
      .eq("subject", subject)
      .eq("endpoint", endpoint)
      .eq("window_start", windowStart)
      .maybeSingle();

    const used = existing?.count ?? 0;
    if (used >= limitPerMin) {
      return jsonResponse(429, {
        error: "RATE_LIMITED",
        message: `Rate limit exceeded. Max ${limitPerMin} requests/minute.`,
        retry_after_seconds: 60 - now.getSeconds(),
      });
    }

    if (existing) {
      await admin.from("rate_limits").update({ count: used + 1 }).eq("id", existing.id);
    } else {
      await admin.from("rate_limits").insert({
        subject, endpoint, window_start: windowStart, count: 1,
      });
    }
    return null;
  } catch (e) {
    // Fail open: never block legitimate traffic because logging/limits broke.
    console.error("enforceRateLimit failed:", e);
    return null;
  }
}

export function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthResult {
  userId: string;
  authType: "jwt" | "apikey";
  apiKeyId?: string;
  rateLimitPerMin?: number;
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function authenticate(
  authHeader: string | null,
  admin: SupabaseClient,
): Promise<{ result?: AuthResult; error?: Response }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "Missing Authorization header" }) };
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token || token.length < 10) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "Invalid authorization token" }) };
  }

  const isJwt = token.split(".").length === 3 && !token.startsWith("pdfgen_");
  if (isJwt) {
    const user = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await user.auth.getUser(token);
    if (error || !data?.user) {
      return { error: jsonResponse(401, { error: "INVALID_TOKEN", message: "Invalid or expired session" }) };
    }
    return { result: { userId: data.user.id, authType: "jwt" } };
  }

  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(token));
  const keyHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { data: keyData, error: keyErr } = await admin
    .from("api_keys")
    .select("id, user_id, is_active, rate_limit_per_min")
    .eq("key_hash", keyHash)
    .single();
  if (keyErr || !keyData) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "API key not found" }) };
  }
  if (!keyData.is_active) {
    return { error: jsonResponse(401, { error: "INVALID_KEY", message: "API key has been revoked" }) };
  }
  return { result: { userId: keyData.user_id, authType: "apikey", apiKeyId: keyData.id, rateLimitPerMin: keyData.rate_limit_per_min ?? DEFAULT_RATE_LIMIT_PER_MIN } };
}

// Load a PDF from either base64 (data URI or raw) or an https URL.
export async function loadPdf(input: unknown, label = "pdf"): Promise<Uint8Array> {
  if (typeof input !== "string" || !input) {
    throw new Error(`${label}: must be a base64 string or https URL`);
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    await assertPublicHttpsUrl(input, label);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(input, { redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (res.status >= 300 && res.status < 400) {
      throw new Error(`${label}: redirects are not allowed`);
    }
    if (!res.ok) throw new Error(`${label}: fetch failed (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
    assertLooksLikePdf(buf, label);
    return buf;
  }
  // base64 (strip data: prefix if present)
  const b64 = input.includes(",") ? input.split(",")[1] : input;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length > MAX_PDF_BYTES) throw new Error(`${label}: exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit`);
    assertLooksLikePdf(bytes, label);
    return bytes;
  } catch {
    throw new Error(`${label}: invalid base64 payload`);
  }
}

export async function uploadPdf(
  admin: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
  filename: string,
): Promise<{ url: string; path: string; sizeBytes: number }> {
  const id = crypto.randomUUID();
  const path = `${userId}/api-${id}-${filename}`;
  const { error: upErr } = await admin.storage
    .from("generated-pdfs")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
  const { data: urlData, error: urlErr } = await admin.storage
    .from("generated-pdfs")
    .createSignedUrl(path, 3600);
  if (urlErr || !urlData?.signedUrl) throw new Error("Failed to sign URL");
  return { url: urlData.signedUrl, path, sizeBytes: bytes.length };
}

export async function logUsage(
  admin: SupabaseClient,
  auth: AuthResult,
  endpoint: string,
  processingTimeMs: number,
  bytesProcessed: number,
  status: "success" | "error" = "success",
) {
  if (auth.authType !== "apikey" || !auth.apiKeyId) return;
  await Promise.all([
    admin.from("api_usage").insert({
      api_key_id: auth.apiKeyId,
      user_id: auth.userId,
      endpoint,
      status,
      document_count: 1,
      processing_time_ms: processingTimeMs,
      bytes_processed: bytesProcessed,
    }),
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", auth.apiKeyId),
  ]).catch((e) => console.error("logUsage:", e));
}

// SSRF guard: require https, disallow credentials, and block private/loopback/
// link-local/metadata targets both by hostname and by resolved IP (DNS rebinding).
function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipToLong(ip);
  if (n === null) return true;
  const inRange = (start: string, prefix: number) => {
    const s = ipToLong(start)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (n & mask) === (s & mask);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) || // link-local + AWS/GCP metadata 169.254.169.254
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("192.0.0.0", 24) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 4) ||
    inRange("240.0.0.0", 4)
  );
}

function isBlockedIPv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
  if (s.startsWith("fe80:")) return true; // link-local
  if (s.startsWith("::ffff:")) {
    const v4 = s.slice(7);
    return isBlockedIPv4(v4);
  }
  return false;
}

async function assertPublicHttpsUrl(raw: string, label: string) {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error(`${label}: invalid URL`); }
  if (u.protocol !== "https:") throw new Error(`${label}: only https URLs are allowed`);
  if (u.username || u.password) throw new Error(`${label}: URL credentials are not allowed`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower === "metadata.google.internal"
  ) {
    throw new Error(`${label}: host is not allowed`);
  }
  // If the hostname is a literal IP, check directly.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIPv4(host)) throw new Error(`${label}: private/internal IP is not allowed`);
    return;
  }
  if (host.includes(":")) {
    if (isBlockedIPv6(host)) throw new Error(`${label}: private/internal IP is not allowed`);
    return;
  }
  // Resolve DNS and block if any address is private (DNS rebinding defense).
  try {
    const records = await Promise.allSettled([
      Deno.resolveDns(host, "A"),
      Deno.resolveDns(host, "AAAA"),
    ]);
    const ips: string[] = [];
    for (const r of records) if (r.status === "fulfilled") ips.push(...r.value);
    if (ips.length === 0) throw new Error(`${label}: could not resolve host`);
    for (const ip of ips) {
      if (ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip)) {
        throw new Error(`${label}: host resolves to a private/internal address`);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(`${label}:`)) throw e;
    throw new Error(`${label}: DNS resolution failed`);
  }
}
