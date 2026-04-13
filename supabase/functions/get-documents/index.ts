import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse(405, { error: "METHOD_NOT_ALLOWED", message: "Only GET requests are accepted" });
  }

  try {
    // Validate API key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "INVALID_KEY", message: "Missing Authorization header" });
    }

    const apiKey = authHeader.replace("Bearer ", "").trim();
    if (!apiKey || apiKey.length < 10) {
      return jsonResponse(401, { error: "INVALID_KEY", message: "Invalid API key format" });
    }

    // Hash API key
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up API key
    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, user_id, is_active")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyData) {
      return jsonResponse(401, { error: "INVALID_KEY", message: "API key not found" });
    }

    if (!keyData.is_active) {
      return jsonResponse(401, { error: "INVALID_KEY", message: "API key has been revoked" });
    }

    // Parse query params
    const url = new URL(req.url);
    const docId = url.searchParams.get("id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Single document retrieval
    if (docId) {
      const { data: doc, error: docError } = await supabase
        .from("generated_documents")
        .select("id, title, template, language, page_size, size_bytes, storage_path, created_at")
        .eq("id", docId)
        .eq("user_id", keyData.user_id)
        .single();

      if (docError || !doc) {
        return jsonResponse(404, { error: "NOT_FOUND", message: "Document not found" });
      }

      let download_url: string | null = null;
      if (doc.storage_path) {
        const { data: urlData } = await supabase.storage
          .from("generated-pdfs")
          .createSignedUrl(doc.storage_path, 3600);
        download_url = urlData?.signedUrl || null;
      }

      return jsonResponse(200, {
        success: true,
        document: {
          id: doc.id,
          title: doc.title,
          template: doc.template,
          language: doc.language,
          page_size: doc.page_size,
          size_bytes: doc.size_bytes,
          download_url,
          created_at: doc.created_at,
          expires_in: download_url ? "1 hour" : null,
        },
      });
    }

    // List documents
    const { data: docs, error: docsError, count } = await supabase
      .from("generated_documents")
      .select("id, title, template, language, page_size, size_bytes, storage_path, created_at", { count: "exact" })
      .eq("user_id", keyData.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (docsError) {
      return jsonResponse(500, { error: "FETCH_FAILED", message: "Failed to retrieve documents" });
    }

    // Generate signed URLs for docs that have storage_path
    const documentsWithUrls = await Promise.all(
      (docs || []).map(async (doc) => {
        let download_url: string | null = null;
        if (doc.storage_path) {
          const { data: urlData } = await supabase.storage
            .from("generated-pdfs")
            .createSignedUrl(doc.storage_path, 3600);
          download_url = urlData?.signedUrl || null;
        }
        return {
          id: doc.id,
          title: doc.title,
          template: doc.template,
          language: doc.language,
          page_size: doc.page_size,
          size_bytes: doc.size_bytes,
          download_url,
          created_at: doc.created_at,
        };
      })
    );

    return jsonResponse(200, {
      success: true,
      documents: documentsWithUrls,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (err) {
    console.error("get-documents error:", err);
    return jsonResponse(500, { error: "FETCH_FAILED", message: "Internal server error" });
  }
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
