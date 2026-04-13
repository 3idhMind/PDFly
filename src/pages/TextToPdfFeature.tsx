import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/config";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import textHeroImg from "@/assets/text-to-pdf-hero.jpg";
import {
  FileText, Languages, Palette, Code, Layers, Globe, Shield,
  ArrowRight, CheckCircle, Zap, BookOpen
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const TextToPdfFeature = () => {
  const features = [
    { icon: Languages, title: "70+ Languages", desc: "Hindi, Arabic, Chinese, Japanese, Korean, Hinglish, Tamil, Telugu, Bengali and many more with automatic font selection" },
    { icon: Palette, title: "15 Professional Templates", desc: "Minimal, Professional, Creative, Modern, Classic, Elegant, Bold, Tech, Academic, Corporate, Artistic, Clean, Vibrant, Dark, Light" },
    { icon: Globe, title: "Full RTL Support", desc: "Arabic, Hebrew, Urdu, Persian — bidirectional text rendering with correct layout and number handling" },
    { icon: Layers, title: "Batch Generation", desc: "Generate up to 10 PDFs in a single API request. Perfect for invoices, certificates, reports at scale" },
    { icon: Code, title: "REST API", desc: "Developer-friendly API with code examples in JavaScript, Python, PHP, Go, and cURL" },
    { icon: Shield, title: "HTML & Markdown", desc: "Send raw HTML with CSS or plain text. Use tables, headings, images, custom styles — full control over layout" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Text to PDF Converter — 70+ Languages, 15 Templates | PDFly</title>
        <meta name="description" content="Convert any text, HTML, or markdown to beautiful PDFs in 70+ languages. Free REST API, 15 professional templates, batch generation, RTL support. No credit card." />
        <meta name="keywords" content="text to PDF, HTML to PDF, markdown to PDF, Hindi PDF generator, Arabic PDF, multi-language PDF, free PDF API, PDFly" />
        <meta property="og:title" content="Text to PDF — 70+ Languages, 15 Templates | PDFly" />
        <meta property="og:description" content="Convert text to PDF in 70+ languages with PDFly. Free API, batch processing, RTL support." />
        <link rel="canonical" href={`${SITE_URL}/text-to-pdf`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "PDFly Text to PDF",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          description: "Convert text, HTML, and markdown to PDF in 70+ languages with 15 templates",
        })}</script>
      </Helmet>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 dot-pattern opacity-40" />
          <div className="container mx-auto px-4 max-w-7xl relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
                <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-primary text-sm font-medium mb-6">
                  <FileText className="w-4 h-4" /> Text to PDF
                </motion.div>
                <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-extrabold font-display text-foreground mb-6 tracking-tight">
                  Convert Text to <span className="gradient-text">Beautiful PDFs</span>
                </motion.h1>
                <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
                  Generate professional PDF documents from any text, HTML, or markdown content. Support for 70+ languages including Hindi, Arabic, Chinese with full RTL rendering. 15 templates, 11 page sizes, batch processing.
                </motion.p>
                <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
                  <Button size="lg" asChild className="btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]">
                    <Link to="/app"><Zap className="w-5 h-5 mr-2" /> Open Generator — Free</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/docs"><BookOpen className="w-5 h-5 mr-2" /> API Docs</Link>
                  </Button>
                </motion.div>
              </motion.div>
              <motion.div className="hidden lg:block" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-accent/15 rounded-3xl blur-2xl" />
                  <img src={textHeroImg} alt="Text to PDF conversion" width={1024} height={768} className="relative rounded-2xl shadow-2xl border border-border/30" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.h2 className="text-3xl md:text-4xl font-bold font-display text-foreground text-center mb-12" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
              Feature Highlights
            </motion.h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                  <Card className="p-6 h-full premium-card glass">
                    <f.icon className="w-8 h-8 text-primary mb-4" />
                    <h3 className="font-semibold font-display text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 relative">
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="container mx-auto px-4 max-w-4xl relative">
            <h2 className="text-3xl font-bold font-display text-foreground text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: "Enter Content", desc: "Paste text, HTML with inline CSS, or markdown content. Set language for proper font rendering." },
                { step: "2", title: "Choose Style", desc: "Pick a template (15 options), page size (11 options), and customization settings." },
                { step: "3", title: "Generate PDF", desc: "Get your PDF instantly via the web app or through the REST API programmatically." },
              ].map((s, i) => (
                <motion.div key={s.step} className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground mx-auto mb-4 shadow-lg">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-semibold font-display text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Supported Languages Preview */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-2xl font-bold font-display text-foreground mb-8">Supported Languages (70+)</h2>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {["English", "Hindi", "Hinglish", "Arabic", "Chinese", "Japanese", "Korean", "Tamil", "Telugu", "Bengali", "Gujarati", "Punjabi", "Urdu", "Thai", "Vietnamese", "Russian", "French", "German", "Spanish", "Portuguese"].map(lang => (
                <span key={lang} className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{lang}</span>
              ))}
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">+50 more</span>
            </div>
          </div>
        </section>

        {/* CTA & Backlinks */}
        <section className="py-20 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
          <div className="container mx-auto px-4 max-w-3xl text-center relative">
            <h2 className="text-3xl font-bold font-display text-foreground mb-4">Start Converting Text to PDF</h2>
            <p className="text-muted-foreground mb-8">Free — no credit card, no limits. Start now.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Button size="lg" asChild className="btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]">
                <Link to="/app"><FileText className="w-5 h-5 mr-2" /> Open Generator</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth"><ArrowRight className="w-5 h-5 mr-2" /> Create Free Account</Link>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" size="sm" asChild><Link to="/image-to-pdf">Image to PDF</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/docs">API Docs</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/pricing">Pricing</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/blog">Blog</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/blog/html-to-pdf-api-guide">HTML to PDF Guide</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/blog/multi-language-pdf-generation">Multi-language PDFs</Link></Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TextToPdfFeature;
