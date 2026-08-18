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
 * ── Round two: "live" turned out to mean "live after the next deploy" ────
 * The first fix pointed the app at `dist/blog-index.json`, a file `postbuild`
 * writes at build time. That solved the blank-page bug but reintroduced a
 * version of the same drift: publishing a post through the API updated
 * Firestore immediately, and a visitor browsing the site saw nothing new
 * until someone ran a build and deployed it. The founder noticed this while
 * testing and it is a real defect, not a misunderstanding — a "publish"
 * button that does not publish is the bug.
 *
 * So the primary source is now the live endpoint, `GET /api/blog`, which
 * reads Firestore on every call. A post is visible to every visitor the
 * moment the write succeeds. No deploy, no commit, nothing to remember.
 *
 * `blog-index.json` still exists and is still written by `postbuild.mjs`, but
 * it is now only a fallback for when the live endpoint is unreachable — a
 * network blip should not blank the blog page, and stale content beats no
 * content. It can lag Firestore by as much as one deploy cycle, which is
 * exactly why it is the fallback and not the source.
 *
 * ── Why this is still fine for SEO ────────────────────────────────────────
 * Crawlers never wait for either fetch. Each blog page already carries its
 * full body inside the prerendered HTML from `postbuild.mjs`, so the article
 * is in the very first response regardless of what happens after hydration.
 * A brand new post's *prerendered* page and its sitemap entry still only
 * appear after the next deploy — that is a separate, accepted limitation of
 * a statically prerendered site, not the bug being fixed here. What this
 * fixes is the live site showing the post to a human visitor at all.
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
    cache = fetch("/api/blog", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { posts?: BlogPost[] }) => {
        if (!Array.isArray(d.posts) || d.posts.length === 0) throw new Error("empty");
        return d.posts;
      })
      .catch(() =>
        // The live endpoint is down or briefly empty. Fall back to whatever
        // was baked in at the last build rather than showing nothing.
        fetch("/blog-index.json", { headers: { accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((d: { posts?: BlogPost[] }) => (Array.isArray(d.posts) ? d.posts : []))
          .catch(() => []),
      );

    // Do not cache an empty result: an empty array is what both sources
    // return on failure, and caching it would mean a working retry never
    // happens for the rest of the page's life.
    cache.then((posts) => {
      if (posts.length === 0) cache = null;
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
