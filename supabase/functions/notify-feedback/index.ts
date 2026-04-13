import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate: require service-role or shared secret
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const { record } = payload;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    
    if (webhookUrl) {
      // Send to n8n webhook which can forward to Gmail
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_feedback",
          feedback: {
            name: record.name || "Anonymous",
            email: record.email || "No email",
            message: record.message,
            rating: record.rating || "No rating",
            created_at: record.created_at,
          },
        }),
      });
    }

    // Also log to console for monitoring
    console.log("New feedback received:", {
      name: record.name,
      rating: record.rating,
      message: record.message?.substring(0, 100),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Feedback notification error:", err);
    return new Response(JSON.stringify({ error: "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
