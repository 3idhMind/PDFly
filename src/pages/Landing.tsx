import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ToolShowcase } from "@/components/ToolShowcase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fs, getDb } from "@/lib/firebase/firestore";
import { useState } from "react";
import { SITE_URL } from "@/lib/config";
import {
  Code, Shield, Languages, ArrowRight, Star, Send, Lock, Globe, Palette, Check,
} from "lucide-react";

const TICKER = [
  "Zero Uploads", "25+ Image Formats", "15 Templates", "100% Free & Private",
  "60 req/min API", "11 Page Sizes", "Zero Upload", "Open Source",
];

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
    try {
      const [{ addDoc, collection, serverTimestamp }, db] = await Promise.all([fs(), getDb()]);
      await addDoc(collection(db, "feedback"), {
        name: feedbackName.trim(),
        email: feedbackEmail.trim(),
        message: feedbackMsg.trim(),
        rating: feedbackRating || null,
        path: window.location.pathname,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      setFeedbackName(""); setFeedbackEmail(""); setFeedbackMsg(""); setFeedbackRating(0);
    } catch {
      toast({
        title: "Couldn't send that",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="PDFly — Free PDF Tools. Files Never Leave Your Browser."
        description="Merge, split, compress, resize and convert PDFs and photos free — 100% in your browser, nothing uploaded. Built for exam and government portal uploads. Free API for developers too."
        keywords="free PDF tools, compress PDF, merge PDF, split PDF, resize photo to KB, PDF to image, client-side PDF, private PDF tools, PDFly"
        canonical={SITE_URL}
      />
      <Header />

      {/* HERO ───────────────────────────────────────────── */}
      {/*
        Rewritten to lead with the tool, not the API. The V1 target is
        someone arriving from Google mid-task (a rejected exam upload, a file
        too big for a portal) — not a developer evaluating an API. See
        _internal/PRD.md §1 and _internal/STRATEGY.md. The REST API still gets
        a single line here (site does have one, worth knowing) and its own
        full section further down the page — never the hero's main claim.
      */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 -z-10 animate-slow-pulse-bg" style={{
          background: "radial-gradient(ellipse at 30% 40%, hsl(175 80% 80% / 0.35), transparent 60%)",
        }} />
        <div className="absolute inset-0 -z-10 dot-pattern opacity-50" />

        <div className="container mx-auto px-5 max-w-7xl pt-14 md:pt-24 pb-16 md:pb-28">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-10 items-center">
            {/* Left text — 60% (3/5) */}
            <div className="lg:col-span-3 space-y-6 lg:space-y-7 text-center lg:text-left">
              <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-primary border border-primary/40 bg-primary/5 pill-glow">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  100% Free — Every Tool Unlocked
                </span>
              </div>

              <h1 className="animate-fade-up font-display font-bold tracking-tight text-[32px] sm:text-[42px] md:text-[56px] leading-[1.05]" style={{ animationDelay: "100ms" }}>
                Every PDF tool you need,{" "}
                <span className="font-serif-display italic text-primary font-normal">without uploading your file.</span>
              </h1>

              <p className="animate-fade-up text-[16px] md:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed" style={{ animationDelay: "200ms" }}>
                Compress a PDF to an exact size, resize a photo for an exam or portal upload, merge, split, convert — all inside your browser. Nothing ever leaves your device.
              </p>

              <div className="animate-fade-up flex flex-col sm:flex-row gap-3 justify-center lg:justify-start" style={{ animationDelay: "300ms" }}>
                <Button asChild size="lg" className="h-12 px-7 rounded-full text-base bg-primary hover:bg-primary/90 text-primary-foreground btn-press animate-pulse-glow">
                  <Link to="/create">Use a Tool — Free <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6 rounded-full text-base border-foreground/20 hover:bg-foreground hover:text-background btn-press">
                  <Link to="/exam/upsc-photo-signature-size">Exam Photo/Signature Size</Link>
                </Button>
              </div>

              <div className="animate-fade-up flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 pt-2 text-xs text-muted-foreground" style={{ animationDelay: "400ms" }}>
                <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Zero upload</span>
                <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Open source</span>
                <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> No account needed</span>
                <Link to="/docs" className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Code className="w-3.5 h-3.5" /> Free REST API for developers
                </Link>
              </div>
            </div>

            {/* Right — tool showcase, 40% (2/5) */}
            <div className="lg:col-span-2">
              <ToolShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* TICKER ─────────────────────────────────────────── */}
      <section className="border-y border-border bg-background py-4 overflow-hidden">
        <div className="relative flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee whitespace-nowrap">
            {[...TICKER, ...TICKER].map((item, i) => (
              <span key={i} className="flex items-center mx-6 text-sm font-medium text-foreground/80">
                {item}
                <span className="ml-12 w-1.5 h-1.5 rounded-full bg-primary" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* BENTO FEATURES ────────────────────────────────── */}
      <section className="py-24">
        <div className="container mx-auto px-5 max-w-7xl">
          <div className="mb-14 max-w-2xl">
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-3">
              Everything you need.{" "}
              <span className="font-serif-display italic font-normal text-muted-foreground">Nothing you don't.</span>
            </h2>
            <p className="text-muted-foreground text-lg">Built for developers and humans both.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[minmax(220px,_auto)]">
            {/* 1 — Privacy First (wide x2) */}
            <Card className="md:col-span-2 p-7 premium-card rounded-2xl border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col justify-between overflow-hidden relative">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" /> 01 · Privacy First
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold mb-2.5">Files never leave your device.</h3>
                <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                  All conversion happens inside your browser. No upload, no server-side copy, no logs. Even offline — it still works.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-3 self-start">
                <div className="relative w-16 h-12 rounded-lg border-2 border-foreground/20 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-foreground/40" />
                  <Lock className="w-4 h-4 absolute -bottom-2 -right-2 p-0.5 bg-primary text-primary-foreground rounded-full" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">browser-only</span>
              </div>
            </Card>

            {/* 2 — Scripts */}
            <Card className="p-7 premium-card rounded-2xl border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden relative">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                <Languages className="w-3.5 h-3.5" /> 02 · Scripts
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">Nothing Is Uploaded</h3>
              <p className="text-muted-foreground text-sm mb-3">Every web tool runs in your tab. Works offline once loaded.</p>
              <div className="h-24 overflow-hidden relative">
                <div className="flex flex-col gap-1 animate-marquee" style={{ animation: "float 6s linear infinite" }}>
                  {["Merge", "Split", "Compress", "PDF → Images", "Images → PDF", "Text → PDF", "No signup", "No watermark"].map(l => (
                    <span key={l} className="text-sm text-foreground/70">{l}</span>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
              </div>
            </Card>

            {/* 3 — REST API (dark) */}
            <Card className="md:row-span-2 p-7 premium-card rounded-2xl border-0 bg-[#0D0D0D] text-white shadow-xl overflow-hidden relative">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                <Code className="w-3.5 h-3.5" /> 03 · REST API
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">One curl away.</h3>
              <p className="text-white/60 text-sm mb-5">Drop-in REST endpoint. JSON in, PDF out. The API renders Latin scripts today.</p>
              <pre className="font-mono text-[11px] leading-relaxed text-white/90 bg-white/5 rounded-lg p-4 border border-white/10 overflow-x-auto">
{`curl -X POST \\
  https://pdfly.3idhmind.in/api/generate-pdf \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "documents": [{
      "title": "Hello",
      "content": "# Hello"
    }],
    "template": "minimal"
  }' \\
  --output out.pdf`}
              </pre>
              <Link to="/docs" className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-primary hover:gap-2.5 transition-all">
                Read the docs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Card>

            {/* 4 — Templates */}
            <Card className="md:col-span-2 p-7 premium-card rounded-2xl border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden relative">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5" /> 04 · Templates
              </div>
              <h3 className="font-display text-2xl font-bold mb-1">15 Templates</h3>
              <p className="text-muted-foreground text-sm mb-5">Professional, minimal, academic, creative — pick your style.</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {["Professional", "Minimal", "Academic", "Creative", "Dark", "Modern", "Editorial"].map((t, i) => (
                  <div key={t} className="shrink-0 w-24 h-32 rounded-lg border border-border bg-background overflow-hidden flex flex-col" style={{ background: i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                    <div className="h-2 bg-primary/60" />
                    <div className="p-2 flex-1 space-y-1">
                      <div className="h-1 bg-foreground/80 rounded w-3/4" />
                      <div className="h-0.5 bg-foreground/30 rounded w-full" />
                      <div className="h-0.5 bg-foreground/30 rounded w-5/6" />
                      <div className="h-0.5 bg-foreground/30 rounded w-4/6" />
                      <div className="h-0.5 bg-foreground/30 rounded w-full mt-1.5" />
                      <div className="h-0.5 bg-foreground/30 rounded w-3/6" />
                    </div>
                    <div className="px-2 pb-1.5 text-[8px] font-mono text-muted-foreground truncate">{t}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 5 — Free comparison (wide x3) */}
            <Card className="md:col-span-3 p-7 premium-card rounded-2xl border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden relative">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                <Check className="w-3.5 h-3.5" /> 05 · Completely Free
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-bold mb-5">No "premium" tier. No watermarks. No catch.</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground py-2.5 w-1/3"></th>
                      <th className="text-left font-medium text-muted-foreground py-2.5">iLovePDF</th>
                      <th className="text-left font-medium text-muted-foreground py-2.5">PDF Candy</th>
                      <th className="text-left font-display font-bold text-primary py-2.5">PDFly</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px]">
                    {[
                      ["Free PDFs / day", "25", "1 / hour", "Unlimited"],
                      ["API access", "Paid", "Paid", "Free"],
                      ["Watermark", "Free tier", "Free tier", "Never"],
                      ["File upload required", "Yes", "Yes", "No — browser only"],
                    ].map(row => (
                      <tr key={row[0]} className="border-b border-border/60 last:border-0">
                        <td className="py-3 text-foreground font-sans">{row[0]}</td>
                        <td className="py-3 text-muted-foreground">{row[1]}</td>
                        <td className="py-3 text-muted-foreground">{row[2]}</td>
                        <td className="py-3 text-primary font-medium">{row[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FEEDBACK ───────────────────────────────────────── */}
      <section className="py-24 border-t border-border bg-muted/30" id="feedback">
        <div className="container mx-auto px-5 max-w-2xl">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              Tell us what you think.
            </h2>
            <p className="text-muted-foreground">Good, bad, ugly — every word helps.</p>
          </div>
          <Card className="p-7 rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <form onSubmit={submitFeedback} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Your name (optional)" value={feedbackName} onChange={(e) => setFeedbackName(e.target.value)} className="h-11 rounded-full px-5" />
                <Input type="email" placeholder="Your email (optional)" value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="h-11 rounded-full px-5" />
              </div>
              <div className="flex items-center gap-2.5 pl-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Rating:</span>
                {[1, 2, 3, 4, 5].map((r) => (
                  <button key={r} type="button" onClick={() => setFeedbackRating(r)} className="transition-transform duration-150 hover:scale-110 active:scale-95">
                    <Star className={`w-5 h-5 ${r <= feedbackRating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
              <Textarea placeholder="Bugs, ideas, praise, criticism — anything." value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} rows={4} required className="rounded-2xl resize-none" />
              <Button type="submit" className="w-full h-12 rounded-full text-base bg-primary hover:bg-primary/90 btn-press" disabled={sending}>
                <Send className="w-4 h-4 mr-2" /> {sending ? "Sending..." : "Submit Feedback"}
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {/* CTA ───────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 dot-pattern opacity-40" />
        <div className="container mx-auto px-5 max-w-3xl text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-4 tracking-tight leading-tight">
            Ready when{" "}
            <span className="font-serif-display italic font-normal text-primary">you are.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-9 max-w-md mx-auto">
            No credit card. No subscription. No tricks. Just a fast, private PDF tool.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="h-12 px-7 rounded-full text-base bg-primary hover:bg-primary/90 btn-press animate-pulse-glow">
              <Link to="/create">Explore All Tools <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 rounded-full text-base border-foreground/20 hover:bg-foreground hover:text-background btn-press font-mono">
              <Link to="/docs">{"</>"} Read the API Docs</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
