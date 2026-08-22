import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { routeByPath, SITE_ORIGIN } from "@/lib/routeMeta";

/**
 * Per-page metadata, defaulting to the one place that already defines it.
 *
 * ── Why title and description are optional ────────────────────────────────
 * `scripts/postbuild.mjs` bakes a title and description into each static HTML
 * file from `routeMeta.ts`, and every page component then set its own again by
 * hand. Those two copies had drifted on every route checked — twelve out of
 * twelve. A crawler fetched "Pricing — PDFly Is Free", rendered the page, and
 * got "Pricing — Free PDF Tools and a Free API Tier" instead. Google treats
 * that instability as a reason to write its own title, which is the opposite of
 * what any of this work is for.
 *
 * So the default is now no argument at all: the component looks the current
 * path up in `routeMeta.ts` and uses exactly what the prerender used. Pass a
 * title only where it genuinely cannot be static — a blog post, a tool page
 * rendered from a slug — and never to restate what routeMeta already says.
 */
interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
}

export const SEOHead = ({ title, description, keywords, canonical, ogType = "website" }: SEOHeadProps) => {
  const { pathname } = useLocation();
  // Trailing slashes are stripped so "/pricing/" and "/pricing" resolve alike;
  // `cleanUrls` means both can be reached.
  const meta = routeByPath(pathname.replace(/\/+$/, "") || "/");

  const resolvedTitle = title ?? meta?.title ?? "PDFly";
  const resolvedDescription = description ?? meta?.description ?? "";
  const resolvedCanonical =
    canonical ?? (meta ? `${SITE_ORIGIN}${meta.path === "/" ? "" : meta.path}` : undefined);

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:type" content={ogType} />
      {resolvedCanonical && <meta property="og:url" content={resolvedCanonical} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      {resolvedCanonical && <link rel="canonical" href={resolvedCanonical} />}
    </Helmet>
  );
};
