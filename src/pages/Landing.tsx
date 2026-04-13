import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect } from "react";
import heroImage from "@/assets/hero-3d-docs.jpg";
import { SITE_URL } from "@/lib/config";
import {
  FileText, Globe, Zap, Code, Layers, Shield, Palette, Languages,
  ArrowRight, Star, CheckCircle, Send, Sparkles, Rocket, ImagePlus,
  Users, BarChart3, Lock
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const } }),
};

const AnimatedCounter = ({ target, suffix = "" }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
};

const FloatingShape = ({ className, delay = 0 }: { className?: string; delay?: number }) => (
  <motion.div
    className={`absolute rounded-full opacity-20 ${className}`}
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 0.15 }}
    transition={{ duration: 1.5, delay }}
    style={{ background: "var(--gradient-primary)" }}
  />
);

const Landing = () => {
  const { toast } = useToast();
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [sending, setSending] = useState(false);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) {
      toast({ title: "Message required", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("feedback").insert({
      name: feedbackName.trim(),
      email: feedbackEmail.trim(),
      message: feedbackMsg.trim(),
      rating: feedbackRating || null,
    } as any);
    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      setFeedbackName("");
      setFeedbackEmail("");
      setFeedbackMsg("");
      setFeedbackRating(0);
    }
  };

  const features = [
    { icon: Languages, title: "70+ Languages", desc: "Hindi, Arabic, Chinese, Japanese, Hinglish and many more with full RTL support", link: "/text-to-pdf" },
    { icon: Palette, title: "15 Templates", desc: "Professional, creative, minimal, dark, academic — pick your style", link: "/text-to-pdf" },
    { icon: Code, title: "REST API", desc: "Developer-friendly API with code examples in 5+ languages", link: "/docs" },
    { icon: Layers, title: "Batch Generation", desc: "Generate up to 10 PDFs in a single request", link: "/docs" },
    { icon: Globe, title: "11 Page Sizes", desc: "A4, Letter, Legal, A3, A5, Tabloid, Square, Reel and more" },
    { icon: Shield, title: "Secure & Fast", desc: "SHA-256 hashed API keys, rate limiting, and blazing-fast generation" },
    { icon: ImagePlus, title: "Image to PDF", desc: "Convert 100+ images (25+ formats incl. HEIC, WebP, RAW) into a single PDF", link: "/image-to-pdf" },
  ];

  const stats = [
    { value: 70, suffix: "+", label: "Languages" },
    { value: 25, suffix: "+", label: "Image Formats" },
    { value: 15, suffix: "", label: "Templates" },
    { value: 10, suffix: "K+", label: "PDFs Generated" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="PDFly — Free PDF Generator & Image to PDF | 70+ Languages, REST API"
        description="Generate beautiful PDFs in 70+ languages or convert 100+ images to PDF with PDFly. Free REST API, 15 templates, 25+ image formats. No credit card required."
        keywords="PDF generator, free PDF API, HTML to PDF, image to PDF, JPG to PDF, PNG to PDF, HEIC to PDF, multi-language PDF, Hindi PDF, Arabic PDF, REST API PDF, batch PDF generation, 3idhMind, PDFly"
        canonical={SITE_URL}
      />
      <Header />

      {/* Hero Section — Split Layout */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        <div className="absolute inset-0 dot-pattern" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <FloatingShape className="w-72 h-72 -top-20 -right-20 blur-3xl animate-float" delay={0} />
        <FloatingShape className="w-56 h-56 top-1/3 -left-16 blur-3xl animate-float-reverse" delay={0.5} />

        <div className="container mx-auto px-4 py-20 md:py-28 max-w-7xl relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — Text */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass text-primary text-sm font-medium mb-8 animate-border-glow border-primary/30">
                <Sparkles className="w-4 h-4" /> 100% Free — All Features Unlocked
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-5xl md:text-7xl lg:text-8xl font-extrabold font-display tracking-tighter mb-6">
                <span className="gradient-text">PDFly</span>
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-2xl md:text-3xl font-display font-semibold text-foreground mb-4">
                Universal PDF Generator
              </motion.p>

              <motion.p variants={fadeUp} custom={3} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed">
                Convert text to beautiful PDFs in 70+ languages. Convert 100+ images to PDF. Free REST API, 15 templates — everything you need.
              </motion.p>

              <motion.div variants={fadeUp} custom={4} className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-base px-8 h-13 shadow-lg btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]">
                  <Link to="/app"><Rocket className="w-5 h-5 mr-2" /> Start Generating — Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-base px-8 h-13 hover:-translate-y-0.5 transition-all duration-300">
                  <Link to="/docs"><Code className="w-5 h-5 mr-2" /> API Documentation</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Right — 3D Hero Image */}
            <motion.div
              className="hidden lg:block relative"
              initial={{ opacity: 0, x: 40, rotateY: -8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl animate-pulse-glow" />
                <img
                  src={heroImage}
                  alt="PDFly 3D PDF documents floating"
                  width={1024}
                  height={1024}
                  className="relative rounded-2xl shadow-2xl border border-border/30"
                />
                {/* Glass overlay card */}
                <div className="absolute -bottom-6 -left-6 glass-strong rounded-xl px-5 py-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Instant Generation</p>
                      <p className="text-xs text-muted-foreground">Under 500ms</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 glass-strong rounded-xl px-4 py-2 shadow-lg">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">100+ Images → PDF</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 border-y border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 animate-gradient" />
        <div className="container mx-auto px-4 max-w-5xl relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-4xl md:text-5xl font-extrabold font-display gradient-text mb-1">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold font-display text-foreground mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Powerful features, zero complexity. Build, generate, and deliver.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Card className="p-7 h-full premium-card glass group relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <f.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold font-display text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  {f.link && (
                    <Link to={f.link} className="absolute inset-0 rounded-xl" aria-label={f.title} />
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern" />
        <div className="container mx-auto px-4 max-w-6xl relative">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold font-display text-foreground mb-4">Two Powerful Tools</h2>
            <p className="text-muted-foreground text-lg">Choose your conversion path</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Text to PDF */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Card className="p-8 h-full premium-card glass-strong gradient-border">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 shadow-lg">
                  <FileText className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold font-display text-foreground mb-3">Text to PDF</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">Convert any text, HTML, or markdown to beautiful PDFs. Support for 70+ languages, 15 templates, batch processing, and full REST API access.</p>
                <ul className="space-y-2 mb-6">
                  {["70+ languages with RTL", "15 professional templates", "Batch generation (10 docs)", "HTML & Markdown support"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <Button asChild className="btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]">
                    <Link to="/app">Open Generator</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/text-to-pdf">Learn More</Link>
                  </Button>
                </div>
              </Card>
            </motion.div>
            {/* Image to PDF */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Card className="p-8 h-full premium-card glass-strong gradient-border">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center mb-6 shadow-lg">
                  <ImagePlus className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold font-display text-foreground mb-3">Image to PDF</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">Convert 100+ images into a single PDF document. Supports 25+ formats including HEIC, WebP, TIFF, RAW. Client-side processing for speed & privacy.</p>
                <ul className="space-y-2 mb-6">
                  {["25+ image formats", "100+ images per PDF", "Drag & drop reorder", "Client-side processing"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-accent shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <Button asChild className="btn-gradient-sweep bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%]">
                    <Link to="/images-to-pdf">Convert Images</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/image-to-pdf">Learn More</Link>
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-4xl relative">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold font-display text-foreground mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Three steps to your perfect PDF</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30" />
            {[
              { step: "1", title: "Enter Content", desc: "Paste your text, HTML, markdown — or upload images. Supports 70+ languages including RTL scripts." },
              { step: "2", title: "Pick Style", desc: "Choose a template, page size, orientation, and fit mode. Preview your PDF in real-time." },
              { step: "3", title: "Generate & Download", desc: "Get your PDF instantly. Use the web app or REST API — your choice." },
            ].map((s, i) => (
              <motion.div key={s.step} className="text-center relative z-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold font-display text-primary-foreground mx-auto mb-5 shadow-lg animate-pulse-glow">
                  {s.step}
                </div>
                <h3 className="text-xl font-semibold font-display text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-16 border-y border-border/40">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm text-muted-foreground font-medium mb-6 uppercase tracking-wider">Trusted by developers & businesses worldwide</p>
            <div className="flex flex-wrap justify-center gap-8 items-center opacity-60">
              {[
                { icon: Users, label: "Startups" },
                { icon: BarChart3, label: "SaaS Companies" },
                { icon: Globe, label: "Global Teams" },
                { icon: Lock, label: "Enterprise" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="py-24 relative" id="feedback">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="container mx-auto px-4 max-w-2xl relative">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold font-display text-foreground mb-4">We Value Your Feedback</h2>
            <p className="text-muted-foreground text-lg">Good or bad — every word helps us improve PDFly.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="p-8 glass-strong shadow-lg">
              <form onSubmit={submitFeedback} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input placeholder="Your name (optional)" value={feedbackName} onChange={(e) => setFeedbackName(e.target.value)} className="bg-background/60" />
                  <Input type="email" placeholder="Your email (optional)" value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="bg-background/60" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground font-medium">Rating:</span>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" onClick={() => setFeedbackRating(r)} className="transition-all duration-200 hover:scale-125">
                      <Star className={`w-6 h-6 ${r <= feedbackRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`} />
                    </button>
                  ))}
                </div>
                <Textarea placeholder="Tell us what you think — bugs, ideas, praise, criticism — anything! *" value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} rows={4} required className="bg-background/60" />
                <Button type="submit" className="w-full shadow-md hover:shadow-lg transition-shadow btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]" size="lg" disabled={sending}>
                  <Send className="w-4 h-4 mr-2" /> {sending ? "Sending..." : "Submit Feedback"}
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-24 border-t border-border/40" id="pricing">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold font-display text-foreground mb-4">100% Free — Limited Time</h2>
            <p className="text-muted-foreground text-lg mb-10">All features unlocked. No credit card. No limits. Start now.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="shadow-md btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]">
                <Link to="/pricing"><ArrowRight className="w-5 h-5 mr-2" /> View Pricing Details</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="hover:-translate-y-0.5 transition-all">
                <Link to="/app"><FileText className="w-5 h-5 mr-2" /> Start Free</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-accent/4 to-primary/8" />
        <div className="absolute inset-0 grid-pattern" />
        <FloatingShape className="w-48 h-48 top-10 right-10 blur-3xl animate-float" />
        <FloatingShape className="w-32 h-32 bottom-10 left-10 blur-2xl animate-float-reverse" />

        <div className="container mx-auto px-4 max-w-3xl text-center relative">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold font-display text-foreground mb-5">Ready to Generate Beautiful PDFs?</h2>
            <p className="text-lg text-muted-foreground mb-10">Join thousands of developers using PDFly. Free — start now.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Button size="lg" asChild className="text-base px-8 h-13 shadow-lg btn-gradient-sweep bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]">
                <Link to="/app"><FileText className="w-5 h-5 mr-2" /> Open Generator</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-base px-8 h-13 hover:-translate-y-0.5 transition-all">
                <Link to="/auth"><ArrowRight className="w-5 h-5 mr-2" /> Create Free Account</Link>
              </Button>
            </div>
            {/* Internal backlinks */}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {[
                { to: "/blog", label: "Blog" },
                { to: "/docs", label: "API Docs" },
                { to: "/pricing", label: "Pricing" },
                { to: "/status", label: "Status" },
                { to: "/text-to-pdf", label: "Text to PDF" },
                { to: "/image-to-pdf", label: "Image to PDF" },
                { to: "/images-to-pdf", label: "Convert Images" },
                { to: "/blog/html-to-pdf-api-guide", label: "HTML to PDF Guide" },
                { to: "/blog/convert-images-to-pdf-free", label: "Image to PDF Guide" },
              ].map((link, i) => (
                <span key={link.to} className="flex items-center gap-3">
                  {i > 0 && <span className="text-border">·</span>}
                  <Link to={link.to} className="text-muted-foreground hover:text-primary transition-colors">{link.label}</Link>
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
