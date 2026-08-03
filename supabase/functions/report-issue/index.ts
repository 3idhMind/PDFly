// Public endpoint that records client-side failures so the admin dashboard can
// surface them. Accepts no file contents — only error metadata.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT = 20;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_LIMIT;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ?? "unknown";
  if (rateLimited(ip)) return json(429, { error: "RATE_LIMITED" });

  try {
    const body = await req.json();
    const message = clip(body?.message, 500);
    if (!message) return json(400, { error: "INVALID_INPUT", message: "'message' is required" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve the signed-in user when a token is supplied (optional).
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = data?.user?.id ?? null;
    }

    await admin.from("security_events").insert({
      event_type: clip(body?.type, 80) ?? "client_failure",
      severity: ["info", "warning", "critical"].includes(body?.severity) ? body.severity : "critical",
      user_id: userId,
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
      details: {
        message,
        tool: clip(body?.tool, 80),
        route: clip(body?.route, 200),
        stack: clip(body?.stack, 2000),
      },
    });

    return json(200, { success: true });
  } catch (err) {
    console.error("report-issue:", (err as Error).message);
    return json(500, { error: "REPORT_FAILED" });
  }
});
