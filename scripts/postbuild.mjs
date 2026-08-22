/**
 * Postbuild: prerender one real HTML file per route, then generate the sitemap.
 *
 * THE PROBLEM THIS SOLVES
 * PDFly is a client-rendered SPA. Before this script, every URL — /merge-pdf,
 * /compress-pdf, /docs, all 40 of them — returned the same 6,275-byte shell
 * carrying the homepage's <title>, with an empty <div id="root">. /compress-pdf
 * contained zero occurrences of the word "compress". Google had nothing to rank
 * on any page, which made every other piece of SEO work pointless.
 *
 * HOW IT WORKS
 * Vercel checks the filesystem BEFORE applying the rewrites in vercel.json.
 * So writing dist/merge-pdf/index.html means that file is served for
 * /merge-pdf, and only unmatched paths fall through to the SPA catch-all.
 * React then hydrates over it exactly as before — the user-facing behaviour is
 * unchanged, but a crawler now gets a real document on first response.
 *
 * This is deliberately a string transform on the built shell rather than a
 * headless-browser render. It cannot go stale relative to the bundle, it adds
 * ~no build time, and it needs no extra dependency. The tradeoff is that the
 * <body> is still the empty root div — crawlers get real metadata and real
 * <h1>/<p> content from the injected block below, not a full DOM snapshot.
 * That is enough to be indexed and ranked; full SSR is a V2 conversation.
 *
 * Run: node scripts/postbuild.mjs   (wired into `npm run build`)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

/* ------------------------------------------------------------------ inputs */

if (!existsSync(join(dist, "index.html"))) {
  console.error("[postbuild] dist/index.html not found — run `vite build` first.");
  process.exit(1);
}

// Node strips the TypeScript types natively, so the app and this script share
// one metadata source instead of drifting apart.
const { TOOLS_DATA, toolByHref, guidesForSlug } = await import(
  pathToFileURL(join(root, "src/lib/toolsData.ts")).href
);

const { ROUTES, SITE_ORIGIN } = await import(
  pathToFileURL(join(root, "src/lib/routeMeta.ts")).href
);

/**
 * Blog posts are parsed out of Blog.tsx rather than duplicated here, so adding
 * a post stays a one-file change. Brittle-by-nature, so it fails loudly: a
 * regex that silently matches nothing would quietly drop every post from both
 * the prerender and the sitemap.
 */
/**
 * Posts come from Firestore via `api/blog.ts`, with the in-repo array as a
 * fallback.
 *
 * The fallback is not laziness. The build must not start failing the day the
 * API has a bad minute, and the very first deploy of this code runs before the
 * endpoint it wants to call exists. So: try the network, and if it does not
 * answer, prerender what is in the repo and say loudly which source was used.
 * A build that silently drops every blog URL from the sitemap is far worse than
 * one that prints which path it took.
 */
async function fetchBlogPosts() {
  const origin = process.env.PDFLY_BLOG_ORIGIN || SITE_ORIGIN;
  try {
    const res = await fetch(`${origin}/api/blog`, {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { posts } = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) throw new Error("no posts returned");
    console.log(`[postbuild] blog source: Firestore (${posts.length} posts via ${origin})`);
    return posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      // The body travels with the post now. It is written to
      // dist/blog-index.json for the app and injected into each prerendered
      // page for crawlers, so neither one has to go back to the API at runtime.
      content: p.content ?? "",
      category: p.category ?? "",
      tags: Array.isArray(p.tags) ? p.tags : [],
      author: p.author ?? "3idhMinds",
      publishAt: p.publishAt ?? null,
      readMinutes: p.readMinutes ?? 5,
    }));
  } catch (err) {
    console.warn(
      `[postbuild] blog source: src/pages/Blog.tsx fallback — ${origin}/api/blog ` +
        `was unreachable (${err.message}). This is expected on a first deploy.`,
    );
    return readBlogPosts();
  }
}

function readBlogPosts() {
  const src = readFileSync(join(root, "src/pages/Blog.tsx"), "utf8");
  const posts = [];
  const entry = /\{\s*slug:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",\s*excerpt:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = entry.exec(src))) {
    posts.push({
      slug: m[1],
      title: m[2].replace(/\\"/g, '"'),
      excerpt: m[3].replace(/\\"/g, '"'),
    });
  }
  if (posts.length === 0) {
    console.error(
      "[postbuild] Parsed 0 blog posts from src/pages/Blog.tsx.\n" +
        "  The blogPosts array shape probably changed. Fix the regex in readBlogPosts()\n" +
        "  rather than letting every blog URL silently vanish from the sitemap.",
    );
    process.exit(1);
  }
  return posts;
}

/* ------------------------------------------------------------ transformation */

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const shell = readFileSync(join(dist, "index.html"), "utf8");

function buildHtml({ path, title, description, noindex }, post = null) {
  const canonical = path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
  const t = esc(title);
  const d = esc(description);

  let html = shell;

  // Replace, don't append — leaving the shell's homepage tags in place would
  // give every page two titles and two descriptions.
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${d}">`,
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/g,
    `<meta property="og:title" content="${t}">`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/g,
    `<meta property="og:description" content="${d}">`,
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/g,
    `<meta name="twitter:title" content="${t}">`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/g,
    `<meta name="twitter:description" content="${d}">`,
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/g,
    `<meta property="og:url" content="${canonical}">`,
  );

  // Replace the shell's robots tag rather than adding a second one. Appending
  // left /auth carrying both `index, follow` and `noindex` — and the shell's
  // came first, so the page advertised itself as indexable.
  const robots = noindex ? "noindex, follow" : "index, follow";
  const robotsTag = `<meta name="robots" content="${robots}">`;
  html = /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/.test(html)
    ? html.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/, robotsTag)
    : html.replace("</head>", `    ${robotsTag}\n  </head>`);

  // Canonical is appended, not replaced: the site-wide canonical was removed
  // from index.html precisely because it pointed every URL at the homepage.
  html = html.replace("</head>", `    <link rel="canonical" href="${canonical}">\n  </head>`);

  // A crawler that does not execute JS still needs words on the page. This is
  // hidden from sighted users (React replaces #root on hydrate) but is real,
  // non-duplicated content matching the page's own metadata — not keyword
  // stuffing, and not text that contradicts what the rendered page says.
  // A blog page ships its whole body, not just its excerpt. Only the title and
  // description were injected before, which left the actual article invisible
  // to anything that does not run JavaScript — on the pages where the text IS
  // the product. `white-space:nowrap` is dropped for the same reason: it was
  // fine for one line and wrong for an article.
  /*
   * What a crawler with no JavaScript actually reads.
   *
   * This used to be the meta description repeated once — 24 to 36 words on
   * every page that is not a blog post, against 877 on the posts. The pages the
   * site most wants ranked were the emptiest ones in the index. Everything
   * below comes from data the rendered page shows too, so the crawled copy and
   * the visible copy say the same thing.
   */
  const tool = toolByHref(path);
  const guides = guidesForSlug(path.slice(1));
  const link = (href, label) => `<a href="${SITE_ORIGIN}${href}">${esc(label)}</a>`;

  let body;
  if (post?.content) {
    body = post.content
      .split(/\n{2,}/)
      .map((para) => `<p>${esc(para.trim())}</p>`)
      .join("");
  } else if (path === "/create") {
    // The tool index. Its whole purpose is the list, so the list is the content.
    body =
      `<p>${d}</p><ul>` +
      TOOLS_DATA.map(
        (t) => `<li>${link(t.href, t.label)} — ${esc(t.desc)} Accepts ${esc(t.accepts)}.</li>`,
      ).join("") +
      "</ul>";
  } else {
    const parts = [`<p>${d}</p>`];

    if (tool) {
      parts.push(`<p>${esc(tool.desc)} Accepts ${esc(tool.accepts)}.</p>`);
    }

    // Preset routes (/compress-pdf-to-200kb and friends) are not entries in the
    // tool list — they are the same component with a target size — so they were
    // falling through with nothing but their description. They are also the
    // pages STRATEGY.md is betting on, which made this the worst place to be
    // thin.
    if (tool || guides.length || /^\/(compress|resize)-/.test(path)) {
      parts.push(
        "<p>Runs entirely in your browser: the file is never uploaded, there is no size limit " +
          "and no account is required.</p>",
      );
    }

    if (guides.length) {
      parts.push(
        "<p>Uploading for an exam? " +
          guides.map((g) => `${link(g.href, g.label)} — ${esc(g.blurb)}`).join(" ") +
          "</p>",
      );
    }

    if (tool || guides.length || /^\/(compress|resize)-/.test(path)) {
      parts.push(
        "<p>Other free tools: " +
          TOOLS_DATA.filter((t) => t.href !== path)
            .slice(0, 6)
            .map((t) => link(t.href, t.label))
            .join(", ") +
          ".</p>",
      );
    }

    body = parts.join("");
  }

  const noscript =
    `<div id="prerender-content" style="position:absolute;width:1px;height:1px;` +
    `overflow:hidden;clip:rect(0 0 0 0)">` +
    `<h1>${t}</h1>${body}</div>`;
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);


  /*
   * Article schema, for blog pages only.
   *
   * The shell carries a site-wide WebApplication/Organization block and every
   * blog post was inheriting it unchanged, so the one content type on this site
   * that Google has a dedicated rich result for was describing itself as a
   * piece of software. The React page adds BlogPosting after hydration, which
   * is too late for the crawl. Appended rather than replacing the shell's: both
   * statements are true, and a page may carry more than one type.
   */
  if (post) {
    const ld = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      url: canonical,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      author: { "@type": "Organization", name: post.author || "3idhMinds" },
      publisher: { "@type": "Organization", name: "3idhMinds", url: SITE_ORIGIN },
      ...(post.publishAt ? { datePublished: String(post.publishAt).slice(0, 10) } : {}),
      ...(post.tags?.length ? { keywords: post.tags.join(", ") } : {}),
      ...(post.category ? { articleSection: post.category } : {}),
      inLanguage: "en",
    };
    html = html.replace(
      "</head>",
      `    <script type="application/ld+json">${JSON.stringify(ld)}</script>
  </head>`,
    );
  }
  return html;
}

function writeRoute(path, html) {
  const dir = path === "/" ? dist : join(dist, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
}

/* ---------------------------------------------------------------- prerender */

const blogPosts = await fetchBlogPosts();

const allRoutes = [
  ...ROUTES,
  ...blogPosts.map((p) => ({
    path: `/blog/${p.slug}`,
    title: `${p.title} | PDFly`,
    description: p.excerpt,
    priority: 0.6,
    changefreq: "monthly",
  })),
];

for (const route of allRoutes) {
  // Blog pages carry their own body, so the crawler sees the article and the
  // app can hydrate from the same HTML without a second request.
  const post = route.path.startsWith("/blog/")
    ? blogPosts.find((p) => `/blog/${p.slug}` === route.path)
    : null;
  writeRoute(route.path, buildHtml(route, post));
}

/* ------------------------------------------------------------- blog data */
/**
 * The single source the app reads at runtime.
 *
 * Posts used to be a TypeScript array compiled into the bundle, so publishing
 * meant editing code. Worse, once the build started reading Firestore the two
 * drifted immediately: a post published through the API was prerendered with
 * the right <title> and then rendered blank, because the React component was
 * still looking the slug up in its own hardcoded map and not finding it.
 * Measured on production before this fix.
 *
 * One file, written from the same list that produced the prerender and the
 * sitemap, so all three cannot disagree.
 */
writeFileSync(join(dist, "blog-index.json"), JSON.stringify({ posts: blogPosts }), "utf8");

/* ---------------------------------------------------------------- soft 404s */
/**
 * Every unknown URL used to answer HTTP 200 with the SPA shell, because
 * vercel.json rewrote `/(.*)` to /index.html. Google calls that a soft 404 and
 * treats those URLs as thin duplicates worth re-crawling — measured live:
 * /this-page-does-not-exist-12345 returned 200 with a 6,319-byte body.
 *
 * Vercel serves `404.html` from the output root with a real 404 status for any
 * path that matches no file, so writing it here plus dropping the catch-all
 * rewrite is the whole fix. Every real route is prerendered to its own file
 * above, so deep links still resolve — only genuinely unknown paths fall
 * through. That also means a route added to App.tsx but not to routeMeta.ts now
 * 404s, which is the correct failure: it would not have been indexable anyway.
 */
writeFileSync(
  join(dist, "404.html"),
  buildHtml({
    path: "/404",
    title: "Page Not Found (404) | PDFly",
    description:
      "That page doesn't exist. Browse PDFly's free browser-based PDF and image tools instead.",
    noindex: true,
  }),
  "utf8",
);

/* ------------------------------------------------------------------ sitemap */

/**
 * `lastmod` is emitted only where a real content date exists.
 *
 * It used to be `new Date()` on every URL, so all 47 claimed to have changed
 * the moment the site was deployed, including pages untouched for months.
 * Google's guidance is that lastmod reflects when the content meaningfully
 * changed; a value that is always "today" is not a signal, and a feed that
 * cries wolf on every deploy teaches the crawler to ignore the field. Omitting
 * it is explicitly allowed and is the honest option, so static routes carry no
 * lastmod and blog posts carry their real publish date.
 */
const sitemapEntries = allRoutes
  .filter((r) => !r.noindex)
  .map((r) => {
    const loc = r.path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${r.path}`;
    const post = r.path.startsWith("/blog/")
      ? blogPosts.find((b) => `/blog/${b.slug}` === r.path)
      : null;
    const lastmod = post?.publishAt ? String(post.publishAt).slice(0, 10) : null;
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      `    <changefreq>${r.changefreq}</changefreq>`,
      `    <priority>${r.priority.toFixed(1)}</priority>`,
      "  </url>",
    ].join("\n");
  })
  .join("\n");

/* ---------------------------------------------------------------- robots */
/**
 * Generated from the same ROUTES list, so a private page cannot be added
 * without robots.txt learning about it. The hand-maintained version had no
 * Disallow at all, which meant /admin, /settings and /analytics were fully
 * crawlable the moment they existed.
 *
 * Two independent mechanisms, because they fail differently:
 *   - `noindex` (baked into each page's HTML by buildHtml) is what actually
 *     keeps a URL out of the index, and it is the one that works even if a
 *     crawler reaches the page from an external link.
 *   - `Disallow` below stops well-behaved crawlers spending budget there at
 *     all, and covers agents that read robots.txt but ignore meta tags.
 *
 * Both are safe together here only because these paths have never been indexed
 * and nothing public links to them. On a URL that is already in the index the
 * correct move is noindex ALONE — a Disallow would stop Google re-crawling the
 * page and therefore stop it ever seeing the noindex that removes it.
 */
const privatePaths = ROUTES.filter((r) => r.noindex).map((r) => r.path);

writeFileSync(
  join(dist, "robots.txt"),
  [
    "# Generated by scripts/postbuild.mjs — do not edit public/robots.txt by hand.",
    "",
    "User-agent: *",
    "Allow: /",
    ...privatePaths.map((p) => `Disallow: ${p}`),
    "Disallow: /api/",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n"),
  "utf8",
);

writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${sitemapEntries}\n` +
    `</urlset>\n`,
  "utf8",
);

console.log(
  `[postbuild] prerendered ${allRoutes.length} routes ` +
    `(${ROUTES.length} static + ${blogPosts.length} blog), ` +
    `sitemap has ${allRoutes.filter((r) => !r.noindex).length} URLs`,
);
