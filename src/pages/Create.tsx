import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";
import { TOOLS } from "@/lib/toolsList";
import { ArrowRight, ShieldCheck, Zap, BadgeCheck } from "lucide-react";

const Create = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="All PDF Tools — Merge, Split, Compress & Convert Free | PDFly"
        description="Pick a free PDF tool: merge, split, compress, PDF to images, images to PDF, and text to PDF. Everything runs in your browser — no upload, no signup."
        canonical={`${SITE_URL}/create`}
      />
      <Header />

      <main className="container mx-auto px-5 py-12 md:py-16 max-w-6xl flex-1">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Choose a PDF tool
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Six tools, zero uploads. Everything below runs locally in your browser — free, no
            watermark, no account needed.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Files never leave your device
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-primary" /> Instant, offline-capable
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground">
            <BadgeCheck className="w-3.5 h-3.5 text-primary" /> Free forever
          </span>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              to={tool.href}
              className="group relative p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <tool.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">{tool.label}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {tool.accepts}
                </span>
                <ArrowRight className="w-4 h-4 text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-muted/30 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Building something?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Every tool is also a REST endpoint. Free API keys, generous limits.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to="/docs"
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border border-border hover:border-primary/40 transition-colors"
            >
              API docs
            </Link>
            <Link
              to="/api-playground"
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Try it live <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Create;
