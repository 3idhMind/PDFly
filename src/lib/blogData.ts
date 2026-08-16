/**
 * The blog's single source of truth in the browser.
 *
 * ── The bug this fixes ────────────────────────────────────────────────────
 * Posts moved to Firestore and the build started prerendering from there, but
 * the React components kept their own hardcoded copies. The two drifted the
 * moment a post was published through the API: `/blog/<new-slug>` was
 * prerendered with the correct <title>, and then rendered blank, because
 * `BlogPost.tsx` looked the slug up in its own map and did not find it.
 * Measured on production.
 *
 * So there is now exactly one runtime source. `scripts/postbuild.mjs` writes
 * `dist/blog-index.json` from the same list that produced the prerendered HTML
 * and the sitemap, which makes it impossible for the three to disagree.
 *
 * ── Why this is not a runtime data dependency for SEO ─────────────────────
 * Crawlers never wait for this. Each blog page already carries its full body
 * in the prerendered HTML, so the article is in the first response. The fetch
 * exists so a human gets the styled page after hydration, not so the content
 * exists at all.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  publishAt: string | null;
  readMinutes: number;
}

let cache: Promise<BlogPost[]> | null = null;

/**
 * Cached as a promise so a page rendering the index and a related-posts list
 * at the same time shares one request instead of racing.
 */
export function loadBlogPosts(): Promise<BlogPost[]> {
  if (!cache) {
    cache = fetch("/blog-index.json", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { posts?: BlogPost[] }) => (Array.isArray(d.posts) ? d.posts : []))
      .catch(() => {
        // Reset so a transient failure does not poison every later call for
        // the life of the page.
        cache = null;
        return [];
      });
  }
  return cache;
}

/** Newest first. `publishAt` is ISO, so a string compare is the right order. */
export function sortByDate(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => (b.publishAt ?? "").localeCompare(a.publishAt ?? ""));
}

/** `2026-08-15` from an ISO timestamp, which is what the cards display. */
export function postDate(post: BlogPost): string {
  return (post.publishAt ?? "").slice(0, 10);
}
