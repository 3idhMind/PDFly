import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  corsHeaders, jsonResponse, getSupabaseAdmin, authenticate, loadPdf, uploadPdf, logUsage,
  assertBodySize, clientIp, enforceRateLimit, logRequest, logSecurityEvent,
  DEFAULT_RATE_LIMIT_PER_MIN,
} from "../_shared/pdf-api.ts";

function parseRanges(input: string, total: number): number[][] {
  const groups: number[][] = [];
  input.split(",").forEach((raw) => {
    const p = raw.trim();
    if (!p) return;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1]));
      const b = Math.min(total, parseInt(m[2]));
      if (a <= b) groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
    } else {
      const n = parseInt(p);
      if (!isNaN(n) && n >= 1 && n <= total) groups.push([n - 1]);
    }
  });
  return groups;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "METHOD_NOT_ALLOWED", message: "Use POST" });

  const start = Date.now();
  const requestId = crypto.randomUUID();
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");
  const admin = getSupabaseAdmin();

  const finish = async (res: Response, userId?: string | null, apiKeyId?: string | null, error?: string) => {
    await logRequest(admin, {
      requestId, endpoint: "/api/split-pdf", method: req.method, statusCode: res.status,
      latencyMs: Date.now() - start, ip, userId, apiKeyId, error: error ?? null,
    });
    return res;
  };

  const tooBig = assertBodySize(req);
  if (tooBig) {
    await logSecurityEvent(admin, {
      eventType: "payload_too_large", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/split-pdf", content_length: req.headers.get("content-length") },
    });
    return finish(tooBig);
  }

  const auth = await authenticate(req.headers.get("Authorization"), admin);
  if (auth.error) {
    await logSecurityEvent(admin, {
      eventType: "auth_rejected", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/split-pdf" },
    });
    return finish(auth.error);
  }

  const subject = auth.result!.apiKeyId ?? auth.result!.userId;
  const limited = await enforceRateLimit(
    admin, subject, "/api/split-pdf", auth.result!.rateLimitPerMin ?? DEFAULT_RATE_LIMIT_PER_MIN,
  );
  if (limited) {
    await logSecurityEvent(admin, {
      eventType: "rate_limited", severity: "warning", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/split-pdf" },
    });
    return finish(limited, auth.result!.userId, auth.result!.apiKeyId);
  }

  try {
    const body = await req.json();
    const { pdf, ranges } = body || {};
    if (!pdf) return finish(jsonResponse(400, { error: "INVALID_INPUT", message: "'pdf' (base64 or URL) is required" }), auth.result!.userId, auth.result!.apiKeyId);
    if (!ranges || typeof ranges !== "string") {
      return finish(jsonResponse(400, { error: "INVALID_INPUT", message: "'ranges' must be a string like '1-3,5,7-9'" }), auth.result!.userId, auth.result!.apiKeyId);
    }

    const bytes = await loadPdf(pdf, "pdf");
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();
    const groups = parseRanges(ranges, total);
    if (groups.length === 0) {
      return finish(jsonResponse(400, { error: "INVALID_INPUT", message: "No valid ranges. Pages 1..N only." }), auth.result!.userId, auth.result!.apiKeyId);
    }
    if (groups.length > 50) {
      return finish(jsonResponse(400, { error: "LIMIT_EXCEEDED", message: "Maximum 50 output segments per request." }), auth.result!.userId, auth.result!.apiKeyId);
    }

    const results: Array<{ name: string; url: string; size_bytes: number; pages: number }> = [];
    let totalOut = 0;
    for (let i = 0; i < groups.length; i++) {
      const doc = await PDFDocument.create();
      const copied = await doc.copyPages(src, groups[i]);
      copied.forEach((p) => doc.addPage(p));
      const outBytes = new Uint8Array(await doc.save());
      totalOut += outBytes.length;
      const range = groups[i];
      const label = range.length === 1
        ? `p${range[0] + 1}`
        : `p${range[0] + 1}-${range[range.length - 1] + 1}`;
      const uploaded = await uploadPdf(admin, auth.result!.userId, outBytes, `split_${label}.pdf`);
      results.push({ name: `split_${label}.pdf`, url: uploaded.url, size_bytes: uploaded.sizeBytes, pages: range.length });
    }

    const ms = Date.now() - start;
    await logUsage(admin, auth.result!, "/api/split-pdf", ms, bytes.length);

    return finish(jsonResponse(200, {
      success: true,
      source_pages: total,
      pdfs: results,
      expires_in_seconds: 3600,
      processing_time_ms: ms,
    }), auth.result!.userId, auth.result!.apiKeyId);
  } catch (err) {
    console.error("split-pdf:", err);
    await logUsage(admin, auth.result!, "/api/split-pdf", Date.now() - start, 0, "error");
    await logSecurityEvent(admin, {
      eventType: "endpoint_error", severity: "critical", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/split-pdf", error: (err as Error).message },
    });
    return finish(
      jsonResponse(500, { error: "SPLIT_FAILED", message: (err as Error).message }),
      auth.result!.userId, auth.result!.apiKeyId, (err as Error).message,
    );
  }
});
