import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/config";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TOOLS } from "@/lib/toolsList";
import { Check, ArrowRight, Shield, Zap, Info, Minus } from "lucide-react";

/**
 * Pricing.
 *
 * ── The rule this page keeps breaking, and why ────────────────────────────
 * An earlier version advertised a "Pro" tier with password protection,
 * webhooks, white-label output, team accounts and custom fonts. None of it
 * existed in any planning document. A pricing page is where a fabricated
 * feature list does the most damage, because it is the page a person reads
 * immediately before deciding whether to trust the product with a document.
 *
 * So: everything below is either shipped and verifiable, or explicitly marked
 * as not built. No "coming soon" on anything without a decision behind it, and
 * no invented limits.
 *
 * ── Numbers ───────────────────────────────────────────────────────────────
 * The API quota and rate limit are the real defaults from api/_lib/quota.ts
 * (PDFLY_FREE_TIER_MONTHLY_QUOTA, PDFLY_RATE_LIMIT_PER_MIN). The ~3 MB
 * response ceiling is Vercel's body cap, not a policy choice, and it is stated
 * as a limitation rather than hidden.
 */

const FREE_TIER_QUOTA = 100;
const RATE_LIMIT_PER_MIN = 60;

const browserIncludes = [
  "Every tool, with no account required",
  "No file size limit and no daily cap",
  "Files never leave your device, so nothing is uploaded",
  "No watermark on any output",
  "Works offline once the page has loaded",
];

const apiIncludes = [
  `${FREE_TIER_QUOTA} documents per month`,
  `${RATE_LIMIT_PER_MIN} requests per minute`,
  "Generate, merge, split, compress and convert",
  "Up to 10 API keys, revocable at any time",
  "No credit card, ever, on the free tier",
];

const apiLimits = [
  "Responses are capped near 3 MB, so very large batches fail",
  "Generated files are returned inline and are not stored",
  "Latin scripts only; the browser tools handle Hindi, Arabic and Chinese",
];

export default function Pricing() {
  const canonical = `${SITE_URL}/pricing`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Pricing — Free PDF Tools and a Free API Tier | PDFly</title>
        <meta
          name="description"
          content="Every PDFly browser tool is free with no account, no watermark and no limits. The REST API has a free tier of 100 documents a month. No paid plan exists yet."
        />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="border-b border-border">
          <div className="container mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Free, and honest about it
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                The browser tools cost nothing and need no account. The API has a free tier.
                There is no paid plan, because we have not built one.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ----------------------------------------------------------- tiers */}
        <section className="container mx-auto max-w-5xl px-5 py-14">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Browser tools */}
            <Card className="flex flex-col p-7">
              <div className="mb-1 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Browser tools
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Free</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No account, no limits, nothing uploaded.
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {browserIncludes.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" className="mt-7 h-12 rounded-full">
                <Link to="/create">
                  Open the tools <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>

            {/* API */}
            <Card className="flex flex-col border-primary/30 p-7">
              <div className="mb-1 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  REST API
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Free tier
                <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                  no card required
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                For scripts, servers and automation.
              </p>

              <ul className="mt-6 space-y-3">
                {apiIncludes.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Stated on the page itself, not buried in the docs. */}
              <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Info className="h-3.5 w-3.5" /> Current limitations
                </p>
                <ul className="space-y-2">
                  {apiLimits.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button asChild variant="outline" size="lg" className="mt-6 h-12 rounded-full">
                <Link to="/docs">
                  Read the API docs <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>
          </div>

          {/* ------------------------------------------------------ no paid tier */}
          <Card className="mt-6 border-dashed p-7">
            <h2 className="text-lg font-semibold text-foreground">Is there a paid plan?</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Not yet, and we would rather say that than show an empty tier with invented
              features. If usage grows past what the free tier can carry, a paid plan will
              exist and will be priced in the open. Nothing that is free today becomes paid
              retroactively.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------- what free covers */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto max-w-5xl px-5 py-14">
            <h2 className="text-xl font-bold text-foreground">
              Every tool below is free, with no account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All of these run in your browser. Your files are never uploaded.
            </p>

            <div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    to={tool.href}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-accent"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium text-foreground">{tool.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- faq */}
        <section className="container mx-auto max-w-3xl px-5 py-14">
          <h2 className="mb-7 text-xl font-bold text-foreground">Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "Why is it free?",
                a: "The browser tools cost us nothing to run. Your device does the work, so there is no server bill that scales with usage. The API does cost money to run, which is why it has a quota.",
              },
              {
                q: "Do you sell my files or my data?",
                a: "No. Files processed by the browser tools never reach a server, so there is nothing to sell. The API processes files in memory and retains nothing after the response.",
              },
              {
                q: "What happens if I exceed the API quota?",
                a: `Requests return a 429 with a clear error code until the month resets. Nothing is charged and nothing is silently dropped. The limit is ${FREE_TIER_QUOTA} documents a month and ${RATE_LIMIT_PER_MIN} requests a minute.`,
              },
              {
                q: "Can I use this commercially?",
                a: "Yes, on both the browser tools and the free API tier, within the Terms of Service.",
              },
              {
                q: "Will the free tier be taken away?",
                a: "The browser tools stay free. If the API free tier ever changes, existing users will be told before it happens, not after.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="mb-1.5 font-semibold text-foreground">{q}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-border p-5 text-sm text-muted-foreground">
            Questions about pricing or usage limits:{" "}
            <a href="mailto:support@3idhmind.in" className="text-primary hover:underline">
              support@3idhmind.in
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
