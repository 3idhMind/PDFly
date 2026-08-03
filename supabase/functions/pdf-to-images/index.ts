import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  corsHeaders, jsonResponse, getSupabaseAdmin, authenticate, loadPdf, uploadPdf, logUsage,
  assertBodySize, clientIp, enforceRateLimit, logRequest, logSecurityEvent,
  DEFAULT_RATE_LIMIT_PER_MIN,
} from "../_shared/pdf-api.ts";

// Server-side PDF-to-Images API: returns each page as its own single-page PDF.
// Rationale: raster PNG/JPEG conversion requires a canvas runtime that is not
// reliably available in Deno edge. For raster output, use the browser tool at
// /pdf-to-images which renders with pdf.js + <canvas>. This endpoint gives
// developers a stable, page-per-file split which most downstream pipelines
// (thumbnailing, per-page OCR) accept directly.
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
      requestId, endpoint: "/api/pdf-to-images", method: req.method, statusCode: res.status,
      latencyMs: Date.now() - start, ip, userId, apiKeyId, error: error ?? null,
    });
    return res;
  };

  const tooBig = assertBodySize(req);
  if (tooBig) {
    await logSecurityEvent(admin, {
      eventType: "payload_too_large", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/pdf-to-images", content_length: req.headers.get("content-length") },
    });
    return finish(tooBig);
  }

  const auth = await authenticate(req.headers.get("Authorization"), admin);
  if (auth.error) {
    await logSecurityEvent(admin, {
      eventType: "auth_rejected", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/pdf-to-images" },
    });
    return finish(auth.error);
  }

  const subject = auth.result!.apiKeyId ?? auth.result!.userId;
  const limited = await enforceRateLimit(
    admin, subject, "/api/pdf-to-images", auth.result!.rateLimitPerMin ?? DEFAULT_RATE_LIMIT_PER_MIN,
  );
  if (limited) {
    await logSecurityEvent(admin, {
      eventType: "rate_limited", severity: "warning", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/pdf-to-images" },
    });
    return finish(limited, auth.result!.userId, auth.result!.apiKeyId);
  }

  try {
    const body = await req.json();
    const { pdf } = body || {};
    if (!pdf) return finish(jsonResponse(400, { error: "INVALID_INPUT", message: "'pdf' (base64 or URL) is required" }), auth.result!.userId, auth.result!.apiKeyId);

    const bytes = await loadPdf(pdf, "pdf");
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();
    if (total > 100) {
      return finish(jsonResponse(400, { error: "LIMIT_EXCEEDED", message: "Max 100 pages per request." }), auth.result!.userId, auth.result!.apiKeyId);
    }

    const pages: Array<{ page: number; url: string; size_bytes: number }> = [];
    for (let i = 0; i < total; i++) {
      const one = await PDFDocument.create();
      const [copied] = await one.copyPages(src, [i]);
      one.addPage(copied);
      const outBytes = new Uint8Array(await one.save());
      const uploaded = await uploadPdf(admin, auth.result!.userId, outBytes, `page_${i + 1}.pdf`);
      pages.push({ page: i + 1, url: uploaded.url, size_bytes: uploaded.sizeBytes });
    }

    const ms = Date.now() - start;
    await logUsage(admin, auth.result!, "/api/pdf-to-images", ms, bytes.length);

    return finish(jsonResponse(200, {
      success: true,
      output_format: "pdf-per-page",
      note: "Server returns each page as a single-page PDF. For raster PNG/JPEG output, use the browser tool at /pdf-to-images.",
      page_count: total,
      pages,
      expires_in_seconds: 3600,
      processing_time_ms: ms,
    }), auth.result!.userId, auth.result!.apiKeyId);
  } catch (err) {
    console.error("pdf-to-images:", err);
    await logUsage(admin, auth.result!, "/api/pdf-to-images", Date.now() - start, 0, "error");
    await logSecurityEvent(admin, {
      eventType: "endpoint_error", severity: "critical", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/pdf-to-images", error: (err as Error).message },
    });
    return finish(
      jsonResponse(500, { error: "CONVERT_FAILED", message: (err as Error).message }),
      auth.result!.userId, auth.result!.apiKeyId, (err as Error).message,
    );
  }
});
