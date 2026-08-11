import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";
import { ShieldCheck, Lock, Wifi, Sparkles } from "lucide-react";

const OTHER_TOOLS = [
  { href: "/merge-pdf", label: "Merge PDF" },
  { href: "/split-pdf", label: "Split PDF" },
  { href: "/compress-pdf", label: "Compress PDF" },
  { href: "/pdf-to-images", label: "PDF to Images" },
  { href: "/images-to-pdf", label: "Images to PDF" },
  { href: "/app", label: "Text to PDF" },
  { href: "/resize-image", label: "Resize Image to KB" },
  { href: "/id-photo-crop", label: "ID Photo Crop" },
  { href: "/rotate-pdf", label: "Rotate PDF" },
  { href: "/delete-pdf-pages", label: "Delete PDF Pages" },
  { href: "/reorder-pdf-pages", label: "Reorder PDF Pages" },
];

interface Props {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  faqs?: { q: string; a: string }[];
  /**
   * Optional HowTo schema steps. AI answer engines (Google AI Overviews,
   * Perplexity, ChatGPT) weight FAQPage/HowTo schema heavily when deciding
   * what to quote directly — see _internal/STRATEGY.md's AEO/GEO notes.
   * Not every page has this populated yet; add real steps per tool rather
   * than a generic "drop file, click button, download" that says nothing.
   */
  howToSteps?: string[];
  children: ReactNode;
}

export const PdfToolLayout = ({ slug, title, metaTitle, metaDescription, tagline, faqs, howToSteps, children }: Props) => {
  const canonical = `${SITE_URL}/${slug}`;
  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `PDFly — ${title}`,
    applicationCategory: "UtilityApplication",
    operatingSystem: "Any",
    url: canonical,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    // No aggregateRating. There was a hardcoded 4.9 from 128 ratings here, on
    // every tool page, on a site that has never collected a single review.
    // That is fabricated structured data, it breaches Google's review-snippet
    // policy, and on a product whose entire pitch is "you can verify this
    // yourself" it is the worst possible thing to be caught doing.
    // Add it back only when real reviews exist and are shown on the page.
  };
  const faqLd = faqs && {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const howToLd = howToSteps && howToSteps.length > 0 && {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: title,
    step: howToSteps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title={metaTitle} description={metaDescription} canonical={canonical} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      {faqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      )}
      {howToLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      )}
      <Header />

      <main className="flex-1 container mx-auto px-5 py-10 md:py-14 max-w-4xl">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="w-3 h-3" /> Free · No signup · No watermark
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold mt-4 tracking-tight">{title}</h1>
          <p className="text-lg text-muted-foreground mt-3 max-w-2xl mx-auto">{tagline}</p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-4 mb-6 flex items-center gap-3 text-sm">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground/90">100% local. Your files never leave your browser.</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Lock className="w-3 h-3" /> Zero upload <Wifi className="w-3 h-3 ml-2" /> Works offline
          </span>
        </div>

        {children}

        {faqs && faqs.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-display font-bold mb-4">Frequently asked</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <details key={i} className="p-4 rounded-lg border border-border bg-card group">
                  <summary className="font-medium cursor-pointer">{f.q}</summary>
                  <p className="text-sm text-muted-foreground mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="mt-16">
          <h2 className="text-xl font-display font-bold mb-4">More free PDF tools</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {OTHER_TOOLS.filter((t) => t.href !== `/${slug}`).map((t) => (
              <Link
                key={t.href}
                to={t.href}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm font-medium"
              >
                {t.label} →
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
