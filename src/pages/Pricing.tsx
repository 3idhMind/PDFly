import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/config";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle, ArrowRight, Zap, Shield, Globe, Code, Layers, Palette,
  ImagePlus, Lock, Merge, FileDown, Webhook, Users, BarChart3, Type
} from "lucide-react";

const Pricing = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>PDFly Pricing — Free PDF Generator & Image to PDF API</title>
        <meta name="description" content="PDFly is 100% free. Generate PDFs in 70+ languages, convert images to PDF, REST API access, 15 templates. No credit card required. Pro plans coming soon." />
        <meta name="keywords" content="free PDF API, PDF generator pricing, free PDF generation, image to PDF free, PDFly pricing, 3idhMind" />
        <meta property="og:title" content="PDFly Pricing — Free PDF Generator & Image to PDF" />
        <meta property="og:description" content="Generate PDFs for free. 70+ languages, 25+ image formats, 15 templates, REST API. No credit card needed." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/pricing`} />
        <link rel="canonical" href={`${SITE_URL}/pricing`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "PDFly",
          description: "Universal PDF generation platform with 70+ languages, image to PDF, and REST API",
          brand: { "@type": "Brand", name: "3idhMind" },
          offers: [
            { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR", availability: "https://schema.org/InStock" },
            { "@type": "Offer", name: "Pro", price: "0", priceCurrency: "INR", availability: "https://schema.org/PreOrder" },
          ],
        })}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 dot-pattern opacity-40" />
          <div className="container mx-auto px-4 max-w-5xl text-center relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-4xl md:text-6xl font-extrabold font-display text-foreground mb-4">Simple, Transparent Pricing</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                PDFly is <span className="text-primary font-semibold">100% free</span> — limited time offer. All features unlocked. No credit card required.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Plans */}
        <section className="pb-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Free */}
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Card className="p-8 h-full border-2 border-primary relative overflow-hidden glass premium-card">
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">CURRENT</div>
                  <h3 className="text-2xl font-bold font-display text-foreground mb-1">Free</h3>
                  <p className="text-4xl font-extrabold font-display text-foreground mb-1">₹0 <span className="text-sm font-normal text-muted-foreground">/ limited time</span></p>
                  <p className="text-sm text-muted-foreground mb-6">Everything included — no limits, no tricks</p>
                  <ul className="space-y-3 mb-8">
                    {[
                      "70+ languages with RTL support",
                      "15 professional templates",
                      "11 page sizes (A4, Letter, Legal, A3...)",
                      "Image to PDF — 100+ images, 25+ formats",
                      "HEIC, WebP, TIFF, RAW support",
                      "Full REST API access",
                      "Batch generation (up to 10 docs)",
                      "60 requests/min rate limit",
                      "Unlimited PDF generation",
                      "API key management",
                      "Analytics dashboard",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full shadow-md btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]" size="lg" asChild>
                    <Link to="/app">Get Started Free <ArrowRight className="w-4 h-4 ml-2" /></Link>
                  </Button>
                </Card>
              </motion.div>

              {/* Pro */}
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Card className="p-8 h-full relative overflow-hidden gradient-border premium-card">
                  <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">COMING SOON</div>
                  <h3 className="text-2xl font-bold font-display text-foreground mb-1">Pro</h3>
                  <p className="text-4xl font-extrabold font-display text-foreground mb-1">TBD</p>
                  <p className="text-sm text-muted-foreground mb-6">For power users and businesses</p>
                  <ul className="space-y-3 mb-8">
                    {[
                      { text: "Everything in Free", icon: CheckCircle },
                      { text: "500 requests/min API rate limit", icon: Zap },
                      { text: "PDF password protection", icon: Lock },
                      { text: "Custom watermarks", icon: Type },
                      { text: "PDF merge — combine multiple PDFs", icon: Merge },
                      { text: "PDF compression & optimization", icon: FileDown },
                      { text: "Webhook notifications", icon: Webhook },
                      { text: "White-label PDFs (no branding)", icon: Shield },
                      { text: "Team accounts & roles", icon: Users },
                      { text: "Advanced analytics", icon: BarChart3 },
                      { text: "Custom fonts upload", icon: Palette },
                      { text: "Priority support", icon: ArrowRight },
                    ].map((f) => (
                      <li key={f.text} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <f.icon className="w-4 h-4 text-accent shrink-0 mt-0.5" /> {f.text}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" size="lg" variant="outline" disabled>Coming Soon</Button>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16 relative">
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="container mx-auto px-4 max-w-3xl relative">
            <h2 className="text-2xl font-bold font-display text-foreground text-center mb-10">Feature Comparison</h2>
            <Card className="overflow-hidden glass">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-display font-semibold text-foreground">Feature</th>
                      <th className="text-center p-4 font-display font-semibold text-primary">Free</th>
                      <th className="text-center p-4 font-display font-semibold text-accent">Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Text to PDF", "✓", "✓"],
                      ["Image to PDF (25+ formats)", "✓", "✓"],
                      ["70+ Languages & RTL", "✓", "✓"],
                      ["15 Templates", "✓", "✓"],
                      ["REST API", "✓", "✓"],
                      ["Batch Generation", "Up to 10", "Up to 50"],
                      ["API Rate Limit", "60/min", "500/min"],
                      ["PDF Password Protection", "—", "✓"],
                      ["Custom Watermarks", "—", "✓"],
                      ["PDF Merge", "—", "✓"],
                      ["PDF Compression", "—", "✓"],
                      ["Webhooks", "—", "✓"],
                      ["White-label", "—", "✓"],
                      ["Team Accounts", "—", "✓"],
                      ["Custom Fonts", "—", "✓"],
                      ["Priority Support", "Community", "Priority"],
                    ].map(([feature, free, pro]) => (
                      <tr key={feature} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="p-4 text-foreground">{feature}</td>
                        <td className="p-4 text-center text-primary font-medium">{free}</td>
                        <td className="p-4 text-center text-accent font-medium">{pro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="py-16 relative">
          <div className="container mx-auto px-4 max-w-5xl relative">
            <h2 className="text-2xl font-bold font-display text-foreground text-center mb-10">What's Included Free</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Globe, title: "70+ Languages", desc: "Hindi, Arabic, Chinese, Japanese, Hinglish — all natively supported" },
                { icon: ImagePlus, title: "Image to PDF", desc: "Convert 100+ images in 25+ formats into a single PDF" },
                { icon: Palette, title: "15 Templates", desc: "Professional, creative, minimal, dark, academic, and more" },
                { icon: Code, title: "REST API", desc: "Full API with code examples in JavaScript, Python, PHP, Go" },
                { icon: Layers, title: "Batch Processing", desc: "Generate up to 10 PDFs in one API call" },
                { icon: Shield, title: "Secure", desc: "SHA-256 hashed API keys with per-key rate limiting" },
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
              <Button variant="outline" size="sm" asChild><Link to="/app">PDF Generator</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/images-to-pdf">Images to PDF</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/text-to-pdf">Text to PDF Features</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/image-to-pdf">Image to PDF Features</Link></Button>
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
