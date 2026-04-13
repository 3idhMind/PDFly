import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_RETRY = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate: require service-role Authorization header
  const authHeader = req.headers.get("Authorization");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (
    !authHeader ||
    authHeader !== `Bearer ${supabaseServiceRoleKey}`
  ) {
    return jsonResponse(401, { error: "UNAUTHORIZED", message: "Invalid or missing authorization" });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

    // Query documents older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: docs, error: fetchError } = await supabase
      .from("generated_documents")
      .select("id, user_id, title, template, language, page_size, size_bytes, created_at, retry_count")
      .lt("created_at", oneHourAgo);

    if (fetchError) {
      console.error("Failed to fetch documents:", fetchError);
      return jsonResponse(500, { error: "FETCH_FAILED", message: fetchError.message });
    }

    if (!docs || docs.length === 0) {
      return jsonResponse(200, { message: "No documents to clean up", deleted: 0, archived: 0 });
    }

    let archivedCount = 0;
    let deletedCount = 0;
    let failedCount = 0;

    // Split docs: those that can still retry vs those that exceeded max retries
    const canRetry = docs.filter((d) => d.retry_count < MAX_RETRY);
    const exceededRetry = docs.filter((d) => d.retry_count >= MAX_RETRY);

    // Try sending to webhook if URL is configured and there are docs to archive
    let webhookSuccess = false;
    if (webhookUrl && webhookUrl.trim() !== "" && canRetry.length > 0) {
      try {
        const payload = {
          documents: canRetry.map((d) => ({
            user_id: d.user_id,
            title: d.title,
            template: d.template,
            language: d.language,
            page_size: d.page_size,
            size_bytes: d.size_bytes,
            created_at: d.created_at,
            retry_count: d.retry_count,
          })),
          timestamp: new Date().toISOString(),
          batch_id: crypto.randomUUID(),
        };

        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (webhookResponse.ok) {
          webhookSuccess = true;
          archivedCount = canRetry.length;
        } else {
          console.error(`Webhook returned ${webhookResponse.status}: ${await webhookResponse.text()}`);
        }
      } catch (webhookError) {
        console.error("Webhook call failed:", webhookError);
      }
    } else if (!webhookUrl || webhookUrl.trim() === "") {
      // No webhook configured — treat all as exceeded retry (delete directly)
      console.warn("N8N_WEBHOOK_URL not configured. Deleting documents without archiving.");
    }

    // If webhook succeeded → delete those docs
    if (webhookSuccess && canRetry.length > 0) {
      const ids = canRetry.map((d) => d.id);
      const { error: delError } = await supabase
        .from("generated_documents")
        .delete()
        .in("id", ids);

      if (delError) {
        console.error("Failed to delete archived docs:", delError);
      } else {
        deletedCount += ids.length;
      }
    }

    // If webhook failed → increment retry_count for canRetry docs
    if (!webhookSuccess && canRetry.length > 0 && webhookUrl && webhookUrl.trim() !== "") {
      for (const doc of canRetry) {
        await supabase
          .from("generated_documents")
          .update({ retry_count: doc.retry_count + 1 })
          .eq("id", doc.id);
      }
      failedCount = canRetry.length;
    }

    // Delete docs that exceeded max retries (give up on archiving)
    if (exceededRetry.length > 0) {
      const ids = exceededRetry.map((d) => d.id);
      const { error: delError } = await supabase
        .from("generated_documents")
        .delete()
        .in("id", ids);

      if (delError) {
        console.error("Failed to delete exceeded-retry docs:", delError);
      } else {
        deletedCount += ids.length;
      }
    }

    // If no webhook configured, delete canRetry docs too
    if ((!webhookUrl || webhookUrl.trim() === "") && canRetry.length > 0) {
      const ids = canRetry.map((d) => d.id);
      const { error: delError } = await supabase
        .from("generated_documents")
        .delete()
        .in("id", ids);

      if (delError) {
        console.error("Failed to delete docs (no webhook):", delError);
      } else {
        deletedCount += ids.length;
      }
    }

    return jsonResponse(200, {
      message: "Cleanup completed",
      archived: archivedCount,
      deleted: deletedCount,
      failed_retries: failedCount,
      exceeded_max_retries: exceededRetry.length,
    });
  } catch (err) {
    console.error("cleanup-documents error:", err);
    return jsonResponse(500, { error: "CLEANUP_FAILED", message: "Internal server error" });
  }
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
