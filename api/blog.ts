import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Public entry point for blog posts.
 *
 * Stays a top-level function, separate from `/api/admin/*`, because **GET is
 * deliberately unauthenticated**: `scripts/postbuild.mjs` calls it at build
 * time to prerender one static HTML file per post. Putting it behind the admin
 * router would gate the build on a credential and, worse, invite someone to
 * "fix" that by fetching posts in the browser instead — which would hand
 * crawlers an empty shell on the pages that most need indexing.
 *
 * Writes are still admin-only; that check lives in the handler itself.
 */
export { default } from "./_lib/handlers/blogHandler.js";
