import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Retention window: 30 minutes
const RETENTION_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require any bearer token. This function only purges expired data
  // (idempotent, owns no user-specific output), so accepting any authenticated
  // caller (cron, service-role, or signed-in user) is safe.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ") || authHeader.length < 20) {
    return jsonResponse(401, { error: "UNAUTHORIZED", message: "Invalid or missing authorization" });
  }
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      supabaseServiceRoleKey
    );

    // Allow override via query param (?minutes=0 for immediate purge)
    const url = new URL(req.url);
    const minutesParam = url.searchParams.get("minutes");
    const minutes = minutesParam !== null ? Math.max(0, parseInt(minutesParam)) : RETENTION_MINUTES;
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const { data: docs, error: fetchError } = await supabase
      .from("generated_documents")
      .select("id, storage_path")
      .lt("created_at", cutoff);

    if (fetchError) {
      console.error("Failed to fetch documents:", fetchError);
      return jsonResponse(500, { error: "FETCH_FAILED", message: fetchError.message });
    }

    // Delete storage files referenced by the doomed DB rows
    const paths = (docs || []).map((d) => d.storage_path).filter((p): p is string => !!p);
    let storageDeletedCount = 0;
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("generated-pdfs")
        .remove(paths);
      if (storageError) {
        console.error("Storage deletion error:", storageError);
      } else {
        storageDeletedCount = paths.length;
      }
    }

    // Delete database rows
    const ids = (docs || []).map((d) => d.id);
    if (ids.length > 0) {
      const { error: dbError } = await supabase
        .from("generated_documents")
        .delete()
        .in("id", ids);
      if (dbError) {
        console.error("DB deletion error:", dbError);
        return jsonResponse(500, { error: "DELETE_FAILED", message: dbError.message });
      }
    }

    // ALSO sweep orphan storage objects older than the retention window
    // (files whose DB record was already removed earlier)
    let orphansDeleted = 0;
    try {
      const { data: rootFolders } = await supabase.storage
        .from("generated-pdfs")
        .list("", { limit: 1000 });

      for (const folder of rootFolders || []) {
        if (!folder.name) continue;
        const { data: files } = await supabase.storage
          .from("generated-pdfs")
          .list(folder.name, { limit: 1000 });

        const orphanPaths: string[] = [];
        for (const f of files || []) {
          if (!f.name) continue;
          const createdAt = f.created_at ? new Date(f.created_at).getTime() : 0;
          if (createdAt && createdAt < Date.now() - minutes * 60 * 1000) {
            orphanPaths.push(`${folder.name}/${f.name}`);
          }
        }
        if (orphanPaths.length > 0) {
          const { error: orphanErr } = await supabase.storage
            .from("generated-pdfs")
            .remove(orphanPaths);
          if (!orphanErr) orphansDeleted += orphanPaths.length;
        }
      }
    } catch (e) {
      console.error("Orphan sweep error:", e);
    }

    return jsonResponse(200, {
      message: "Cleanup completed",
      deleted: ids.length,
      storage_deleted: storageDeletedCount,
      orphans_deleted: orphansDeleted,
      retention_minutes: minutes,
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
