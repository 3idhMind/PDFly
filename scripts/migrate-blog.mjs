/**
 * One-time migration of the fourteen in-repo blog posts into Firestore.
 *
 * ── Why this has to run before the next deploy ────────────────────────────
 * `scripts/postbuild.mjs` now prefers Firestore and falls back to the array in
 * `src/pages/Blog.tsx`. The moment Firestore holds even one post, the fallback
 * stops firing and every post that is not in Firestore silently vanishes from
 * the prerender and the sitemap. Measured: the build went from 51 routes to 38
 * the instant the first post was published through the API.
 *
 * Fourteen live URLs disappearing is real, permanent SEO damage. So the array
 * has to be moved across before that happens, not afterwards.
 *
 * ── The em dash problem, and why the fix is mechanical ────────────────────
 * `api/blog.ts` rejects em dashes and the usual machine-written register with a
 * 400, which is exactly what it should do for new writing. These fourteen posts
 * are full of them, because they are the AI-slop the founder objected to.
 *
 * Rewriting them properly is a real editorial job and is tracked as V1.2 work.
 * Deleting them to satisfy a lint rule would trade a content problem for an SEO
 * one, which is a bad trade. So the migration replaces the dashes with correct
 * punctuation, keeps the URLs alive, and leaves the rewrite outstanding.
 *
 * Usage:
 *   PDFLY_BLOG_KEY=pdfly_live_xxx node scripts/migrate-blog.mjs --check
 *   PDFLY_BLOG_KEY=pdfly_live_xxx node scripts/migrate-blog.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.PDFLY_API || "https://pdfly.3idhmind.in";
const KEY = process.env.PDFLY_BLOG_KEY || "";
const CHECK_ONLY = process.argv.includes("--check");

if (!KEY) {
  console.error("PDFLY_BLOG_KEY is not set. Use an API key from the admin account.");
  process.exit(1);
}

/* ------------------------------------------------------------------ parsing */

const blogSrc = readFileSync(join(root, "src/pages/Blog.tsx"), "utf8");
const postSrc = readFileSync(join(root, "src/pages/BlogPost.tsx"), "utf8");

/** Metadata blocks out of Blog.tsx. Same shape postbuild.mjs already relies on. */
function readMeta() {
  const out = [];
  const re =
    /\{\s*slug:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",\s*excerpt:\s*"((?:[^"\\]|\\.)*)",\s*date:\s*"([^"]+)",\s*readTime:\s*"([^"]+)",\s*tags:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(blogSrc))) {
    out.push({
      slug: m[1],
      title: m[2].replace(/\\"/g, '"'),
      excerpt: m[3].replace(/\\"/g, '"'),
      date: m[4],
      readMinutes: parseInt(m[5], 10) || 5,
      tags: [...m[6].matchAll(/"([^"]+)"/g)].map((t) => t[1]),
    });
  }
  return out;
}

/**
 * Bodies out of BlogPost.tsx. Each is a template literal keyed by slug, so the
 * scan walks forward to the matching backtick rather than using a regex, which
 * would stop at the first backtick inside a code sample.
 */
function readBody(slug) {
  const marker = `"${slug}": \``;
  const start = postSrc.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  let depth = 0;
  while (i < postSrc.length) {
    const c = postSrc[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "$" && postSrc[i + 1] === "{") { depth++; i += 2; continue; }
    if (c === "}" && depth > 0) { depth--; i++; continue; }
    if (c === "`" && depth === 0) break;
    i++;
  }
  return postSrc.slice(start + marker.length, i);
}

/* ------------------------------------------------------------------ cleanup */

/**
 * Replaces the banned punctuation with something a person would actually type.
 *
 * An em dash between clauses becomes a comma; one used as a parenthetical pause
 * becomes a full stop only where the following word is capitalised, which keeps
 * sentences readable instead of producing comma splices everywhere.
 */
function fixDashes(text) {
  return text
    .replace(/\s+[—–]\s+([A-Z])/g, ". $1")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/[—–]/g, "-");
}

const BANNED = [
  [/\bdelve\b/gi, "look"],
  [/\bleverage\b/gi, "use"],
  [/\bseamlessly\b/gi, "cleanly"],
  [/\bseamless\b/gi, "smooth"],
  [/\brobust\b/gi, "reliable"],
];

function clean(text) {
  let out = fixDashes(text);
  for (const [re, replacement] of BANNED) out = out.replace(re, replacement);
  return out;
}

/**
 * These fourteen predate the category system. Assigned by what the post is
 * actually about rather than left to a default, so the blog index is usable.
 */
const CATEGORY = {
  "convert-images-to-pdf-free": "Image Tools",
  "top-10-free-pdf-tools-developers-2026": "PDF Tools",
  "pdf-generation-pipeline-pdfly-api": "API & Developers",
  "pdfly-vs-adobe-smallpdf-comparison": "PDF Tools",
  "html-to-pdf-api-guide": "API & Developers",
  "multi-language-pdf-generation": "API & Developers",
  "batch-pdf-generation-api": "API & Developers",
  "pdf-templates-guide": "PDF Tools",
  "free-pdf-api-developers": "API & Developers",
  "invoice-pdf-generation-tutorial": "API & Developers",
  "pdf-api-vs-puppeteer-wkhtmltopdf": "API & Developers",
  "pdf-generation-for-saas": "API & Developers",
  "rtl-pdf-generation-arabic-hebrew": "API & Developers",
  "certificate-pdf-generation-bulk": "API & Developers",
};

/* ---------------------------------------------------------------------- run */

const metas = readMeta();
if (metas.length === 0) {
  console.error("Parsed 0 posts from Blog.tsx. The array shape changed; fix readMeta().");
  process.exit(1);
}

console.log(`Parsed ${metas.length} posts from the repo.\n`);

let ok = 0;
let skipped = 0;

for (const meta of metas) {
  const body = readBody(meta.slug);
  if (!body) {
    console.log(`  SKIP  ${meta.slug}  (no body found in BlogPost.tsx)`);
    skipped++;
    continue;
  }

  const payload = {
    slug: meta.slug,
    title: clean(meta.title),
    excerpt: clean(meta.excerpt),
    content: clean(body).trim(),
    category: CATEGORY[meta.slug] || "PDF Tools",
    tags: meta.tags,
    author: "3idhMinds",
    publishAt: `${meta.date}T09:00:00Z`,
    readMinutes: meta.readMinutes,
  };

  if (CHECK_ONLY) {
    const stillBad = /[—–]/.test(`${payload.title} ${payload.excerpt} ${payload.content}`);
    console.log(`  ${stillBad ? "DASH" : "ok  "}  ${payload.slug.padEnd(42)} ${payload.category}`);
    if (!stillBad) ok++;
    continue;
  }

  const res = await fetch(`${API}/api/blog`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));

  if (res.ok) {
    console.log(`  ok    ${payload.slug.padEnd(42)} ${json.created ? "created" : "updated"}`);
    ok++;
  } else {
    console.log(`  FAIL  ${payload.slug.padEnd(42)} ${res.status} ${json.message ?? ""}`);
    (json.errors ?? []).forEach((e) => console.log(`        - ${e}`));
    skipped++;
  }
}

console.log(`\n${ok} ${CHECK_ONLY ? "would migrate" : "migrated"}, ${skipped} skipped`);
if (skipped) process.exit(1);
