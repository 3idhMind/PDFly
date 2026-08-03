import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  corsHeaders, jsonResponse, getSupabaseAdmin, authenticate, loadPdf, uploadPdf, logUsage,
  assertBodySize, clientIp, enforceRateLimit, logRequest, logSecurityEvent,
  DEFAULT_RATE_LIMIT_PER_MIN, MAX_TOTAL_BYTES,
} from "../_shared/pdf-api.ts";

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
      requestId, endpoint: "/api/merge-pdf", method: req.method, statusCode: res.status,
      latencyMs: Date.now() - start, ip, userId, apiKeyId, error: error ?? null,
    });
    return res;
  };

  const tooBig = assertBodySize(req);
  if (tooBig) {
    await logSecurityEvent(admin, {
      eventType: "payload_too_large", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/merge-pdf", content_length: req.headers.get("content-length") },
    });
    return finish(tooBig);
  }

  const auth = await authenticate(req.headers.get("Authorization"), admin);
  if (auth.error) {
    await logSecurityEvent(admin, {
      eventType: "auth_rejected", severity: "warning", ip, userAgent: ua,
      details: { endpoint: "/api/merge-pdf" },
    });
    return finish(auth.error);
  }

  const subject = auth.result!.apiKeyId ?? auth.result!.userId;
  const limited = await enforceRateLimit(
    admin, subject, "/api/merge-pdf", auth.result!.rateLimitPerMin ?? DEFAULT_RATE_LIMIT_PER_MIN,
  );
  if (limited) {
    await logSecurityEvent(admin, {
      eventType: "rate_limited", severity: "warning", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/merge-pdf" },
    });
    return finish(limited, auth.result!.userId, auth.result!.apiKeyId);
  }

  try {
    const body = await req.json();
    const pdfs = body?.pdfs;
    if (!Array.isArray(pdfs) || pdfs.length < 2) {
      return finish(jsonResponse(400, { error: "INVALID_INPUT", message: "'pdfs' must be an array of at least 2 items (base64 or https URLs)" }), auth.result!.userId, auth.result!.apiKeyId);
    }
    if (pdfs.length > 20) {
      return finish(jsonResponse(400, { error: "LIMIT_EXCEEDED", message: "Maximum 20 PDFs per merge request." }), auth.result!.userId, auth.result!.apiKeyId);
    }

    const merged = await PDFDocument.create();
    let totalIn = 0;
    for (let i = 0; i < pdfs.length; i++) {
      const bytes = await loadPdf(pdfs[i], `pdfs[${i}]`);
      totalIn += bytes.length;
      if (totalIn > MAX_TOTAL_BYTES) {
        return finish(jsonResponse(413, {
          error: "LIMIT_EXCEEDED",
          message: `Combined input exceeds ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))}MB.`,
        }), auth.result!.userId, auth.result!.apiKeyId);
      }
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await merged.copyPages(src, src.getPageIndices());
      copied.forEach((p) => merged.addPage(p));
    }
    const out = await merged.save();
    const outBytes = new Uint8Array(out);

    const uploaded = await uploadPdf(admin, auth.result!.userId, outBytes, "merged.pdf");
    const ms = Date.now() - start;
    await logUsage(admin, auth.result!, "/api/merge-pdf", ms, totalIn);

    return finish(jsonResponse(200, {
      success: true,
      url: uploaded.url,
      size_bytes: uploaded.sizeBytes,
      pages_merged: merged.getPageCount(),
      inputs: pdfs.length,
      expires_in_seconds: 3600,
      processing_time_ms: ms,
    }), auth.result!.userId, auth.result!.apiKeyId);
  } catch (err) {
    console.error("merge-pdf:", err);
    await logUsage(admin, auth.result!, "/api/merge-pdf", Date.now() - start, 0, "error");
    await logSecurityEvent(admin, {
      eventType: "endpoint_error", severity: "critical", ip, userAgent: ua,
      userId: auth.result!.userId, details: { endpoint: "/api/merge-pdf", error: (err as Error).message },
    });
    return finish(
      jsonResponse(500, { error: "MERGE_FAILED", message: (err as Error).message }),
      auth.result!.userId, auth.result!.apiKeyId, (err as Error).message,
    );
  }
});
