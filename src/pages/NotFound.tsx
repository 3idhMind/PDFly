/**
 * 404 page.
 *
 * Replaces the scaffold this shipped with, which rendered bare `bg-gray-100`
 * markup with no header, no footer, no dark-mode support and no meta tags.
 *
 * ── The soft-404 problem, and what this can and cannot fix ────────────────
 * PDFly is a static SPA on Vercel. A request for a URL with no prerendered file
 * falls through to the `/(.*) -> /index.html` rewrite, which answers **HTTP
 * 200** and then routes to this component client-side. Google calls that a
 * "soft 404": the page says "not found" but the status line says "fine". Those
 * URLs get crawled repeatedly and can be indexed as thin duplicates, which is
 * exactly the kind of thing that drags a small site's crawl budget down.
 *
 * A `<meta name="robots" content="noindex">` emitted here is the part that
 * genuinely works without a server: Googlebot renders JS, sees noindex, and
 * drops the URL from the index. It is not a substitute for a real 404 status —
 * that needs the page to be served by something that can set one, which is a
 * V2 item tracked in the roadmap.
 */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";
import { TOOLS } from "@/lib/toolsList";

const NotFound = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    console.warn("[404] no route for", pathname);
  }, [pathname]);

  // A dead end is a bad place to leave someone who arrived from a search
  // result. The most-used tools are a better exit than a lone "go home" link.
  const suggestions = TOOLS.slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Page Not Found (404) | PDFly</title>
        <meta
          name="description"
          content="That page doesn't exist. Browse PDFly's free browser-based PDF and image tools instead."
        />
        {/* The one directive that actually takes effect without a server. */}
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl text-center">
          <p className="text-7xl font-bold tracking-tight text-primary sm:text-8xl">404</p>

          <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
            We couldn&apos;t find that page
          </h1>

          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            The link may be broken, or the page may have moved. Every PDFly tool is still
            free and still runs entirely in your browser.
          </p>

          {pathname && (
            <p className="mt-4 break-all font-mono text-xs text-muted-foreground/70">
              {pathname}
            </p>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go to homepage
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full">
              <Link to="/create">
                <Search className="mr-2 h-4 w-4" />
                Browse all tools
              </Link>
            </Button>
          </div>

          <div className="mt-12 border-t border-border pt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Popular tools
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    to={tool.href}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-accent"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium text-foreground">{tool.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
