import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TOOLS } from "@/lib/toolsList";
import { Check, ArrowRight, Shield, Zap, Building2, Mail, Minus } from "lucide-react";

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
 * So: everything below is either shipped and verifiable, or handled by a human
 * on request. No "coming soon" on anything without a decision behind it.
 *
 * ── Why two tiers say "Contact us" instead of a number ────────────────────
 * Growth and Enterprise are set up by hand today. Printing a monthly price
 * would imply a self-serve checkout that does not exist, and inventing one to
 * look more established is exactly the failure described above. "Contact us"
 * is what actually happens, so that is what the page says.
 *
 * ── Numbers ───────────────────────────────────────────────────────────────
 * The quota and rate limit are the real defaults from api/_lib/quota.ts
 * (PDFLY_FREE_TIER_MONTHLY_QUOTA, PDFLY_RATE_LIMIT_PER_MIN). Per-job size
 * ceilings come from the tier table in api/_lib/tiers.ts — keep them in step.
 */

const FREE_TIER_QUOTA = 100;
const RATE_LIMIT_PER_MIN = 60;
const SALES_EMAIL = "support@3idhmind.in";

/** mailto with the tier already in the subject, so the reply has context. */
const mailto = (tier: string) =>
  `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`PDFly ${tier} plan enquiry`)}`;

interface Tier {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  icon: typeof Shield;
  featured?: boolean;
  features: string[];
  cta: { label: string; href: string; external?: boolean; variant?: "default" | "outline" };
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    priceNote: "forever, no card",
    tagline: "Every browser tool, plus an API tier for scripts and side projects.",
    icon: Shield,
    features: [
      `All ${TOOLS.length} browser tools, no account needed`,
      "No file size limit in the browser, ever",
      "Files never leave your device in browser tools",
      `${FREE_TIER_QUOTA} API documents per month`,
      `${RATE_LIMIT_PER_MIN} API requests per minute`,
      "10 MB per API job",
      "Up to 10 API keys, revocable any time",
      "No watermark on any output",
    ],
    cta: { label: "Open the tools", href: "/create" },
  },
  {
    id: "growth",
    name: "Growth",
    price: "Contact us",
    priceNote: "priced to your volume",
    tagline: "For products and teams pushing real document volume through the API.",
    icon: Zap,
    featured: true,
    features: [
      "Everything in Free",
      "1 GB per API job",
      "Raised monthly document quota",
      "Raised per-minute rate limit",
      "Longer file retention window",
      "Email support from the people who built it",
    ],
    cta: { label: "Talk to us", href: mailto("Growth"), external: true },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Contact us",
    priceNote: "dedicated setup",
    tagline: "Jobs past 10 GB, or a deployment that has to be yours alone.",
    icon: Building2,
    features: [
      "Everything in Growth",
      "10 GB and above per job",
      "Dedicated processing capacity",
      "Custom retention and data handling terms",
      "Dedicated support contact",
      "Invoicing and a signed agreement",
    ],
    cta: { label: "Contact sales", href: mailto("Enterprise"), external: true, variant: "outline" },
  },
];

/** Verified against api/_lib/handlers/* — every row here is a real endpoint. */
const API_CAPABILITIES = [
  "Text, HTML or Markdown to PDF, 15 templates",
  "Merge, split, compress",
  "PDF to images, images to PDF",
  "Latin, Devanagari and Arabic script rendering",
  "Signed download links on our own domain",
];

const CURRENT_LIMITS = [
  "Chinese, Japanese, Korean, Hebrew and Thai are not supported on either surface",
  "Arabic renders correct glyphs but without bidirectional reordering",
  "Generated files are deleted one hour after they are made",
];

export default function Pricing() {

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead />

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
                Free where it costs us nothing
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
                The browser tools run on your device, so they are free with no account and no
                limits. The API runs on ours, so it has tiers. Nothing that is free today
                becomes paid retroactively.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ----------------------------------------------------------- tiers */}
        <section className="container mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-6 lg:grid-cols-3">
            {TIERS.map((tier, i) => {
              const Icon = tier.icon;
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.07 }}
                  className="flex"
                >
                  <Card
                    className={`relative flex w-full flex-col p-7 ${
                      tier.featured ? "border-primary shadow-lg shadow-primary/5" : ""
                    }`}
                  >
                    {tier.featured && (
                      <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
                        Most asked for
                      </span>
                    )}

                    <div className="mb-3 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {tier.name}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{tier.priceNote}</p>

                    <p className="mt-4 text-sm text-muted-foreground">{tier.tagline}</p>

                    <ul className="mt-6 flex-1 space-y-3">
                      {tier.features.map((item) => (
                        <li key={item} className="flex gap-3 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      size="lg"
                      variant={tier.cta.variant ?? "default"}
                      className="mt-7 h-12 rounded-full"
                    >
                      {tier.cta.external ? (
                        <a href={tier.cta.href}>
                          <Mail className="mr-2 h-4 w-4" /> {tier.cta.label}
                        </a>
                      ) : (
                        <Link to={tier.cta.href}>
                          {tier.cta.label} <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      )}
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* ------------------------------------------------ capabilities */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card className="p-7">
              <h2 className="text-lg font-semibold text-foreground">What the API does</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The same on every tier. Only the ceilings move.
              </p>
              <ul className="mt-5 space-y-3">
                {API_CAPABILITIES.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-6 h-11 rounded-full">
                <Link to="/docs">
                  Read the API docs <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>

            <Card className="p-7">
              <h2 className="text-lg font-semibold text-foreground">What it does not do yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Stated here rather than discovered at 3am.
              </p>
              <ul className="mt-5 space-y-3">
                {CURRENT_LIMITS.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------- what free covers */}
        <section className="border-t border-border bg-muted/30">
          <div className="container mx-auto max-w-5xl px-5 py-14">
            <h2 className="text-xl font-bold text-foreground">
              All {TOOLS.length} tools below are free, with no account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These run in your browser. Your files are never uploaded, and there is no size limit.
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
                q: "Why is so much of it free?",
                a: "The browser tools cost us nothing to run. Your device does the work, so there is no server bill that scales with usage. The API does cost money to run, which is why it has tiers.",
              },
              {
                q: "Why do Growth and Enterprise not show a price?",
                a: "Because there is no self-serve checkout yet, and printing a number that you cannot actually pay would be theatre. Both are set up by hand today. Email us and you get a real answer from the person who built the thing.",
              },
              {
                q: "Do you sell my files or my data?",
                a: "No. Files processed by the browser tools never reach a server, so there is nothing to sell. API files are deleted an hour after they are made.",
              },
              {
                q: "What happens if I exceed the free API quota?",
                a: `Requests return a 429 with a clear error code until the month resets. Nothing is charged and nothing is silently dropped. The free limits are ${FREE_TIER_QUOTA} documents a month, ${RATE_LIMIT_PER_MIN} requests a minute, and 10 MB per job.`,
              },
              {
                q: "Can I use this commercially?",
                a: "Yes, on the browser tools and on every API tier, within the Terms of Service.",
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
            Questions about pricing, limits or a plan that fits:{" "}
            <a href={mailto("plan")} className="text-primary hover:underline">
              {SALES_EMAIL}
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
