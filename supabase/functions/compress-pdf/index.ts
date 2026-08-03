import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  corsHeaders, jsonResponse, getSupabaseAdmin, authenticate, loadPdf, uploadPdf, logUsage,
  assertBodySize, clientIp, enforceRateLimit, logRequest, logSecurityEvent,
  DEFAULT_RATE_LIMIT_PER_MIN,
} from "../_shared/pdf-api.ts";

// Server-side compression pass: strips metadata, rewrites with object streams.
// Meaningful savings on most PDFs (metadata, xref, unused objects). Image
// re-encoding requires rasterization and is intentionally not done here to
// preserve visual fidelity.
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
      requestId, endpoint: "/api/compress-pdf", method: req.method, statusCode: res.status,
      latencyMs: Date.now() - start, ip, userId, apiKeyId, error: error ?? null,
    });
    return res;
  };

  const tooBig = assertBodySize(req);
  if (tooBig) {
    await logSecurityEvent(admin, {
      eventType: "payload_too_large", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/compress-pdf", content_length: req.headers.get("content-length") },
    });
    return finish(tooBig);
  }

  const auth = await authenticate(req.headers.get("Authorization"), admin);
  if (auth.error) {
    await logSecurityEvent(admin, {
      eventType: "auth_rejected", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/compress-pdf" },
    });
    return finish(auth.error);
  }

  const subject = auth.result!.apiKeyId ?? auth.result!.userId;
  const limited = await enforceRateLimit(
    admin, subject, "/api/compress-pdf", auth.result!.rateLimitPerMin ?? DEFAULT_RATE_LIMIT_PER_MIN,
  );
  if (limited) {
    await logSecurityEvent(admin, {
      eventType: "rate_limited", severity: "warning", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/compress-pdf" },
    });
    return finish(limited, auth.result!.userId, auth.result!.apiKeyId);
  }

  try {
    const body = await req.json();
    const { pdf } = body || {};
    if (!pdf) return finish(jsonResponse(400, { error: "INVALID_INPUT", message: "'pdf' (base64 or URL) is required" }), auth.result!.userId, auth.result!.apiKeyId);

    const bytes = await loadPdf(pdf, "pdf");
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    doc.setTitle(""); doc.setAuthor(""); doc.setSubject(""); doc.setKeywords([]);
    doc.setProducer("PDFly"); doc.setCreator("PDFly");
    const out = new Uint8Array(await doc.save({ useObjectStreams: true, addDefaultPage: false }));

    const uploaded = await uploadPdf(admin, auth.result!.userId, out, "compressed.pdf");
    const ms = Date.now() - start;
    await logUsage(admin, auth.result!, "/api/compress-pdf", ms, bytes.length);

    const ratio = bytes.length > 0 ? out.length / bytes.length : 1;
    return finish(jsonResponse(200, {
      success: true,
      url: uploaded.url,
      original_size_bytes: bytes.length,
      compressed_size_bytes: out.length,
      compression_ratio: Number(ratio.toFixed(3)),
      savings_percent: Number(((1 - ratio) * 100).toFixed(1)),
      expires_in_seconds: 3600,
      processing_time_ms: ms,
    }), auth.result!.userId, auth.result!.apiKeyId);
  } catch (err) {
    console.error("compress-pdf:", err);
    await logUsage(admin, auth.result!, "/api/compress-pdf", Date.now() - start, 0, "error");
    await logSecurityEvent(admin, {
      eventType: "endpoint_error", severity: "critical", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/compress-pdf", error: (err as Error).message },
    });
    return finish(
      jsonResponse(500, { error: "COMPRESS_FAILED", message: (err as Error).message }),
      auth.result!.userId, auth.result!.apiKeyId, (err as Error).message,
    );
  }
});
