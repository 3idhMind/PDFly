import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../firebase.js";
import { requireUser, isAdminAccount } from "../requireUser.js";
import { fail, ok, handledPreflight } from "../http.js";
import { logServerActivity } from "../activity.js";

/**
 * Blog posts, stored in Firestore.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Posts used to be a TypeScript array inside src/pages/Blog.tsx, so publishing
 * meant editing code and redeploying. They now live in the `blogPosts`
 * collection and are written through this endpoint, by three callers:
 *
 *   1. the admin UI in the browser (ID token, ADMIN_EMAIL match)
 *   2. `scripts/publish_post.py` (an API key belonging to the admin account)
 *   3. an agent given that same key
 *
 * There is deliberately no separate "blog key" to create. One API: a key minted
 * by the admin account may publish, a key from any other account may not.
 *
 * ── How this stays indexable ──────────────────────────────────────────────
 * GET is public and unauthenticated on purpose: `scripts/postbuild.mjs` calls
 * it at build time to prerender one static HTML file per post. Posts are NOT
 * fetched by the browser at runtime — that would hand crawlers an empty shell
 * and undo the entire reason prerendering exists. Publishing therefore has two
 * steps: write here, then trigger a rebuild (Vercel Deploy Hook).
 *
 * ── Scheduling ────────────────────────────────────────────────────────────
 * `publishAt` in the future keeps a post out of every public read until that
 * time passes, which is what makes a five-day cadence possible: queue several
 * posts at once, and each becomes visible on its own date at the next rebuild.
 */

/** Only these fields are ever accepted from a caller. */
interface PostInput {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags?: string[];
  author?: string;
  coverImage?: string;
  publishAt?: string;
  readMinutes?: number;
}

const CATEGORIES = [
  "Exam Guides",
  "Government IDs",
  "PDF Tools",
  "Image Tools",
  "API & Developers",
  "Product Updates",
] as const;

/** Lowercase, digits and single hyphens. This becomes a public URL. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The em dash is banned outright, not stripped silently.
 *
 * It is the single most reliable tell of machine-written text, and Google has
 * been demoting exactly that pattern. Rejecting the write is deliberate: a
 * silent replacement would let the habit continue invisibly, whereas a 400
 * forces the sentence to be rewritten. Also catches the en dash and the
 * "delve/leverage/seamless" register that reads the same way.
 */
const BANNED = [
  { pattern: /[—–]/, why: "em/en dash — rewrite the sentence with a comma, colon or full stop" },
  { pattern: /\bdelve\b/i, why: '"delve"' },
  { pattern: /\bleverage\b/i, why: '"leverage" — say "use"' },
  { pattern: /\bseamless(ly)?\b/i, why: '"seamless"' },
  { pattern: /\brobust\b/i, why: '"robust"' },
  { pattern: /\bin today's fast[- ]paced\b/i, why: '"in today\'s fast-paced"' },
  { pattern: /\bit's not just .{1,40}, it's\b/i, why: 'the "it\'s not just X, it\'s Y" construction' },
];

function validate(body: Partial<PostInput>): { errors: string[]; post?: PostInput } {
  const errors: string[] = [];
  const req = (k: keyof PostInput) =>
    typeof body[k] === "string" && (body[k] as string).trim().length > 0;

  if (!req("slug")) errors.push("slug is required");
  else if (!SLUG_RE.test(body.slug!)) errors.push("slug must be lowercase-with-hyphens");
  if (!req("title")) errors.push("title is required");
  if (!req("excerpt")) errors.push("excerpt is required");
  if (!req("content")) errors.push("content is required");
  if (!req("category")) errors.push("category is required");
  else if (!CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])) {
    errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
  }

  const prose = `${body.title ?? ""} ${body.excerpt ?? ""} ${body.content ?? ""}`;
  for (const { pattern, why } of BANNED) {
    if (pattern.test(prose)) errors.push(`Remove ${why}`);
  }

  if (errors.length) return { errors };

  return {
    errors: [],
    post: {
      slug: body.slug!.trim(),
      title: body.title!.trim(),
      excerpt: body.excerpt!.trim(),
      content: body.content!.trim(),
      category: body.category!.trim(),
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 12).map(String) : [],
      author: (body.author ?? "3idhMinds").trim(),
      coverImage: body.coverImage?.trim() || "",
      publishAt: body.publishAt ?? new Date().toISOString(),
      // ~200 words per minute, floor of 1. Saves every caller inventing a number.
      readMinutes:
        body.readMinutes ?? Math.max(1, Math.round(body.content!.split(/\s+/).length / 200)),
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handledPreflight(req, res)) return;

  const col = db().collection("blogPosts");

  /* ------------------------------------------------------------------ read */
  // Public. Used by the build to prerender, and by the admin UI to list.
  if (req.method === "GET") {
    const slug = typeof req.query.slug === "string" ? req.query.slug : null;
    // Only the build and the admin have a reason to see unpublished drafts.
    const includeUnpublished = req.query.all === "1";

    if (includeUnpublished) {
      const caller = await requireUser(req, res);
      if (!caller) return;
      if (!(await isAdminAccount(caller))) {
        return fail(res, 403, "FORBIDDEN", "Admin only.");
      }
    }

    if (slug) {
      const snap = await col.doc(slug).get();
      if (!snap.exists) return fail(res, 404, "NOT_FOUND", "No post with that slug.");
      return ok(res, { post: { slug: snap.id, ...snap.data() } });
    }

    const snap = await col.orderBy("publishAt", "desc").limit(500).get();
    const now = Date.now();
    const posts = snap.docs
      .map((d) => ({ ...(d.data() as Record<string, unknown>), slug: d.id }))
      .filter((p: Record<string, unknown>) => {
        if (includeUnpublished) return true;
        if (p.status === "draft") return false;
        const at = Date.parse(String(p.publishAt ?? ""));
        return Number.isNaN(at) || at <= now; // scheduled posts stay hidden
      });

    return ok(res, { posts, count: posts.length });
  }

  /* ----------------------------------------------------------------- write */
  const caller = await requireUser(req, res);
  if (!caller) return;

  // One API, not two. There is no separate "blog key" to create: any key minted
  // by the admin account can publish, and a key from any other account cannot,
  // whatever it claims. The decision comes from the owner's Firebase-verified
  // email, so it cannot be forged by the caller and it follows the account —
  // revoke admin on the account and every key it ever issued loses this at once.
  if (!(await isAdminAccount(caller))) {
    return fail(res, 403, "FORBIDDEN", "Blog publishing requires the admin account.");
  }

  if (req.method === "POST" || req.method === "PUT") {
    const { errors, post } = validate(req.body ?? {});
    if (errors.length) {
      return fail(res, 400, "INVALID_POST", "Post rejected.", { errors });
    }

    const ref = col.doc(post!.slug);
    const existed = (await ref.get()).exists;

    await ref.set(
      {
        ...post,
        status: "published",
        updatedAt: new Date().toISOString(),
        ...(existed ? {} : { createdAt: new Date().toISOString() }),
      },
      { merge: true },
    );

    await logServerActivity(
      { uid: caller.uid, authType: caller.authType },
      existed ? "blog.updated" : "blog.published",
      { slug: post!.slug, title: post!.title, category: post!.category },
    );

    return ok(
      res,
      {
        slug: post!.slug,
        url: `/blog/${post!.slug}`,
        created: !existed,
        note: "Live after the next build. Trigger the Vercel Deploy Hook to publish now.",
      },
      existed ? 200 : 201,
    );
  }

  if (req.method === "DELETE") {
    const slug = typeof req.query.slug === "string" ? req.query.slug : null;
    if (!slug) return fail(res, 400, "MISSING_SLUG", "Pass ?slug=");
    await col.doc(slug).delete();
    await logServerActivity(
      { uid: caller.uid, authType: caller.authType },
      "blog.deleted",
      { slug },
    );
    return ok(res, { deleted: slug });
  }

  return fail(res, 405, "METHOD_NOT_ALLOWED", "Use GET, POST, PUT or DELETE.");
}
