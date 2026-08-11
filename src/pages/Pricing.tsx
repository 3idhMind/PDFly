import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/config";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle, ArrowRight, Globe, Code, Layers, Palette, ImagePlus, Shield, Minimize2, Crop,
} from "lucide-react";

/**
 * Rewritten. The previous version listed a "Pro" tier with password
 * protection, webhooks, white-label output, team accounts and custom fonts —
 * none of which exist in PRD.md, ROADMAP.md, or anywhere the founder has
 * actually scoped work. That's the exact thing the founder's standing rule
 * ("never fake anything, don't add scope nobody asked for") exists to catch.
 * Pro is genuinely undecided — say so, don't invent a feature list to fill
 * the space. Also dropped "limited time" framing on the free tier: there is
 * no time limit and no plan to add one; implying urgency where none exists
 * is the same category of problem as a fake feature list.
 */
const Pricing = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>PDFly Pricing — Free PDF & Photo Tools, Free API</title>
        <meta name="description" content="PDFly is free — every tool, no limits, no account required. Merge, split, compress, resize photos to an exact KB, convert images to PDF, and a free REST API for developers." />
        <meta name="keywords" content="free PDF tools, free PDF API, PDF generator pricing, compress PDF free, resize image free, PDFly pricing, 3idhMind" />
        <meta property="og:title" content="PDFly Pricing — Free PDF & Photo Tools, Free API" />
        <meta property="og:description" content="Every PDF and photo tool, free, no account needed. Files never leave your browser. Free REST API for developers too." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/pricing`} />
        <link rel="canonical" href={`${SITE_URL}/pricing`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "PDFly",
          description: "Browser-based PDF and photo tools, plus a REST API for developers — files never leave your device",
          brand: { "@type": "Brand", name: "3idhMind" },
          offers: {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
          },
        })}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-14 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 dot-pattern opacity-40" />
          <div className="container mx-auto px-4 max-w-5xl text-center relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl md:text-6xl font-extrabold font-display text-foreground mb-4">Free. All of it.</h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                Every tool on PDFly is free, with no account required to use them and no watermark on the output. An account only exists if you want a REST API key.
              </p>
            </motion.div>
          </div>
        </section>

        {/* What's included */}
        <section className="pb-16 md:pb-20">
          <div className="container mx-auto px-4 max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card className="p-6 md:p-8 border-2 border-primary relative overflow-hidden glass premium-card">
                <h2 className="text-2xl font-bold font-display text-foreground mb-1">Free — no plan to change that</h2>
                <p className="text-4xl font-extrabold font-display text-foreground mb-1">₹0</p>
                <p className="text-sm text-muted-foreground mb-6">Every tool, unlimited use, no watermark</p>
                <ul className="space-y-3">
                  {[
                    "Merge, split, rotate, delete pages, reorder pages",
                    "Compress a PDF to an exact size — presets or custom target",
                    "Resize a photo or signature to an exact KB size",
                    "Crop a photo to Aadhaar/PAN/Voter ID PVC dimensions",
                    "Image to PDF (100+ images, 25+ formats) and PDF to Images",
                    "Text/HTML to PDF — 15 templates, 11 page sizes",
                    "Files never leave your device — every web tool runs in your browser",
                    "No account needed for any web tool",
                    "Free REST API for developers (sign in with Google for a key)",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-8 shadow-md btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]" size="lg" asChild>
                  <Link to="/create">Use a Tool — Free <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
              </Card>
            </motion.div>

            {/* Honest, not a feature list dressed as a plan */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6">
              <Card className="p-6 border border-dashed border-border bg-muted/30">
                <h3 className="font-semibold font-display text-foreground mb-1.5">Higher API limits — later, for developers</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A paid tier is on the roadmap for developers who need a higher rate limit or monthly quota than the free API provides. It isn't built yet and we haven't decided what's in it — we'd rather say that plainly than list features we haven't committed to. The web tools stay free either way; a paid tier, if it happens, is about API limits only.
                </p>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Why free */}
        <section className="py-16 relative">
          <div className="container mx-auto px-4 max-w-5xl relative">
            <h2 className="text-2xl font-bold font-display text-foreground text-center mb-10">What's actually free</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Globe, title: "Private by Default", desc: "Web tools run entirely in your browser — your files are never uploaded" },
                { icon: Minimize2, title: "Exact-size compression", desc: "PDF and photo compression that hits a KB target, not just \"smaller\"" },
                { icon: Crop, title: "ID Photo Crop", desc: "Aadhaar, PAN and Voter ID dimensions for PVC printing, at 600 DPI" },
                { icon: ImagePlus, title: "Image to PDF", desc: "Convert 100+ images in 25+ formats into a single PDF" },
                { icon: Palette, title: "15 Templates", desc: "Professional, creative, minimal, dark, academic, and more" },
                { icon: Code, title: "REST API", desc: "Free API with code examples in JavaScript, Python, PHP, Go" },
                { icon: Layers, title: "Batch Processing", desc: "Generate up to 5 PDFs in one API call" },
                { icon: Shield, title: "Secure by design", desc: "SHA-256 hashed API keys, per-key rate limiting, revocation is immediate" },
              ].map((f) => (
                <Card key={f.title} className="p-5 glass premium-card">
                  <f.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold font-display text-foreground mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Internal Links */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-2xl font-bold font-display text-foreground mb-6">Explore PDFly</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" size="sm" asChild><Link to="/compress-pdf">Compress PDF</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/resize-image">Resize Image to KB</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/merge-pdf">Merge PDF</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/app">Text to PDF</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/docs">API Documentation</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/blog">Blog</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/status">System Status</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/#feedback">Give Feedback</Link></Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
