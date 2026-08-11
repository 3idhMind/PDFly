import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/config";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import imgHeroImg from "@/assets/image-to-pdf-hero.jpg";
import {
  ImagePlus, Layers, Shield, Zap, ArrowRight, CheckCircle,
  BookOpen, FileImage, Monitor, RotateCcw, Maximize
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const supportedFormats = [
  "JPEG/JPG", "PNG", "WebP", "HEIC/HEIF", "GIF", "BMP", "TIFF/TIF",
  "SVG", "ICO", "AVIF", "RAW (CR2)", "RAW (NEF)", "RAW (ARW)",
  "RAW (DNG)", "RAW (ORF)", "RAW (RW2)", "RAW (RAF)", "RAW (PEF)",
  "RAW (SR2)", "RAW (SRW)", "JFIF", "PSD", "EPS", "PCX", "TGA",
];

const ImageToPdfFeature = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Image to PDF Converter — 25+ Formats, 100+ Images | PDFly Free</title>
        <meta name="description" content="Convert JPG, PNG, HEIC, WebP, RAW and 25+ image formats to PDF free. Upload 100+ images, reorder, customize page size. Client-side processing — fast & private." />
        <meta name="keywords" content="image to PDF, JPG to PDF, PNG to PDF, HEIC to PDF, WebP to PDF, RAW to PDF, free image converter, PDFly, bulk image to PDF" />
        <meta property="og:title" content="Image to PDF — 25+ Formats, 100+ Images | PDFly Free" />
        <meta property="og:description" content="Convert 100+ images to a single PDF. Supports HEIC, WebP, RAW, TIFF and more. Free, fast, private." />
        <link rel="canonical" href={`${SITE_URL}/image-to-pdf`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "PDFly Image to PDF",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          description: "Convert 100+ images in 25+ formats to PDF. Supports HEIC, WebP, RAW, TIFF.",
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
                <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-accent text-sm font-medium mb-6">
                  <ImagePlus className="w-4 h-4" /> Image to PDF
                </motion.div>
                <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-extrabold font-display text-foreground mb-6 tracking-tight">
                  Convert Images to <span className="gradient-text">PDF</span>
                </motion.h1>
                <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
                  Upload 100+ images in 25+ formats — JPG, PNG, HEIC, WebP, RAW, TIFF, and more. Combine them into a single PDF document. Client-side processing for speed and privacy.
                </motion.p>
                <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
                  <Button size="lg" asChild className="btn-gradient-sweep bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%]">
                    <Link to="/images-to-pdf"><ImagePlus className="w-5 h-5 mr-2" /> Convert Images — Free</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/docs"><BookOpen className="w-5 h-5 mr-2" /> API Docs</Link>
                  </Button>
                </motion.div>
              </motion.div>
              <motion.div className="hidden lg:block" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-accent/15 to-primary/15 rounded-3xl blur-2xl" />
                  <img src={imgHeroImg} alt="Image to PDF conversion" width={1024} height={768} className="relative rounded-2xl shadow-2xl border border-border/30" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground text-center mb-12">Why PDFly Image to PDF?</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: FileImage, title: "25+ Image Formats", desc: "JPEG, PNG, WebP, HEIC, TIFF, RAW (CR2, NEF, ARW, DNG), GIF, BMP, SVG, AVIF, PSD and more" },
                { icon: Layers, title: "100+ Images Per PDF", desc: "Upload and combine over 100 images into a single PDF. No artificial limits on file count" },
                { icon: RotateCcw, title: "Drag & Drop Reorder", desc: "Rearrange images in your preferred order with intuitive drag-and-drop before conversion" },
                { icon: Monitor, title: "Client-Side Processing", desc: "All conversion happens in your browser. Your images never leave your device — fast and private" },
                { icon: Maximize, title: "Fit Modes", desc: "Choose how images fit pages: Fit (maintain aspect), Fill (cover page), or Original (actual size)" },
                { icon: Shield, title: "REST API", desc: "Programmatic access via API. Send base64-encoded images and get a PDF back. Up to 20 images per API call" },
              ].map((f, i) => (
                <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                  <Card className="p-6 h-full premium-card glass">
                    <f.icon className="w-8 h-8 text-accent mb-4" />
                    <h3 className="font-semibold font-display text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Supported Formats Grid */}
        <section className="py-16 relative">
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="container mx-auto px-4 max-w-4xl relative">
            <h2 className="text-2xl font-bold font-display text-foreground text-center mb-8">Supported Image Formats (25+)</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {supportedFormats.map(fmt => (
                <span key={fmt} className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-secondary text-secondary-foreground border border-border/50">
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-bold font-display text-foreground text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: "Upload Images", desc: "Drag & drop or select images in any of 25+ formats. Upload 100+ images at once." },
                { step: "2", title: "Customize", desc: "Reorder images, choose page size, orientation, and how images fit on pages." },
                { step: "3", title: "Download PDF", desc: "Click convert and download your PDF instantly. All processing happens in your browser." },
              ].map((s, i) => (
                <motion.div key={s.step} className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-2xl font-bold text-primary-foreground mx-auto mb-4 shadow-lg">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-semibold font-display text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA & Backlinks */}
        <section className="py-20 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5" />
          <div className="container mx-auto px-4 max-w-3xl text-center relative">
            <h2 className="text-3xl font-bold font-display text-foreground mb-4">Convert Your Images to PDF Now</h2>
            <p className="text-muted-foreground mb-8">Free — no signup required for basic conversion. Create an account for API access.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Button size="lg" asChild className="btn-gradient-sweep bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%]">
                <Link to="/images-to-pdf"><ImagePlus className="w-5 h-5 mr-2" /> Convert Images</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth"><ArrowRight className="w-5 h-5 mr-2" /> Create Free Account</Link>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" size="sm" asChild><Link to="/text-to-pdf">Text to PDF</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/app">PDF Generator</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/docs">API Docs</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/pricing">Pricing</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/blog">Blog</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/blog/convert-images-to-pdf-free">Image to PDF Guide</Link></Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ImageToPdfFeature;
