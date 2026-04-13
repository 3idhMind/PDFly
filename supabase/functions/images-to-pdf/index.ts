import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "METHOD_NOT_ALLOWED", message: "Use POST method." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { images, page_size = "A4", orientation = "portrait", fit_mode = "fit" } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_INPUT", message: "Missing 'images' array. Provide base64-encoded images." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (images.length > 20) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "LIMIT_EXCEEDED",
          message: `Maximum 20 images per API request. You sent ${images.length}. For 100+ images, use the web UI at /images-to-pdf.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPageSizes = ["A4", "Letter", "Legal", "A3", "A5", "Tabloid"];
    if (!validPageSizes.includes(page_size)) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_INPUT", message: `Invalid page_size. Use one of: ${validPageSizes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["portrait", "landscape"].includes(orientation)) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_INPUT", message: "Invalid orientation. Use 'portrait' or 'landscape'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["fit", "fill", "original"].includes(fit_mode)) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_INPUT", message: "Invalid fit_mode. Use 'fit', 'fill', or 'original'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each image
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.data || typeof img.data !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "INVALID_INPUT", message: `Image at index ${i} missing 'data' field (base64 string required).` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Check base64 size (rough estimate: base64 is ~1.37x original)
      const estimatedBytes = img.data.length * 0.75;
      if (estimatedBytes > 25 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ success: false, error: "PAYLOAD_TOO_LARGE", message: `Image at index ${i} exceeds 25MB limit.` }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "validation_passed",
        received: {
          image_count: images.length,
          page_size,
          orientation,
          fit_mode,
        },
        message: "All images validated successfully. Full PDF assembly is available via the web UI at /images-to-pdf for client-side processing.",
        web_ui_url: "/images-to-pdf",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "INVALID_JSON", message: "Could not parse request body as JSON.", details: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
