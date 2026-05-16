import { Link } from "react-router-dom";
import { FileText, ImagePlus, Globe, Layout, Layers, Upload, GripVertical, Sparkles, ShieldCheck, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { motion } from "framer-motion";

const features = [
  {
    title: "Text to PDF",
    badge: "Client-side · Browser-only",
    description:
      "Transform raw text, code snippets, or documents into beautifully formatted PDFs with full control over language, page size, and template.",
    icon: FileText,
    link: "/app",
    cta: "Convert Your Text to PDF",
    gradient: "from-primary to-accent",
    metadata: [
      { icon: Globe, label: "70+ Languages" },
      { icon: Layout, label: "15+ Templates" },
      { icon: Layers, label: "Zero Upload" },
    ],
  },
  {
    title: "Image to PDF",
    badge: "Client-side · Browser-only",
    description:
      "Combine multiple images — JPG, PNG, WebP, HEIC, and 25+ formats — into a single, organized PDF document with drag-and-drop reordering.",
    icon: ImagePlus,
    link: "/images-to-pdf",
    cta: "Convert Your Images to PDF",
    gradient: "from-accent to-primary",
    metadata: [
      { icon: Upload, label: "25+ Image Formats" },
      { icon: Layers, label: "100+ Images at Once" },
      { icon: GripVertical, label: "Drag & Drop Reorder" },
    ],
  },
];

const Create = () => {
  return (
    <>
      <SEOHead
        title="Create — PDFly | Text to PDF & Image to PDF"
        description="Choose your conversion tool: transform text into formatted PDFs or merge multiple images into a single document."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Choose Your Tool
            </div>
            <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-3">
              What would you like to create?
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Pick a conversion tool below and start generating professional PDFs in seconds.
            </p>
          </motion.div>

          <div className="mb-8 rounded-2xl border border-border/60 bg-card p-5">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Web UI = 100% Client-Side</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Both tools below run entirely in your browser. Your text, files, and images never leave your device. Zero upload, zero leak.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent/10 shrink-0">
                  <Server className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">REST API = Server-Side</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    For programmatic access only. Required so developers can call PDFly from servers, scripts, and automations. <Link to="/docs" className="text-primary hover:underline">View API docs →</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <Card className="h-full flex flex-col p-8 bg-card border border-border/60 shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mb-6 shadow-md`}
                  >
                    <feat.icon className="w-7 h-7 text-primary-foreground" />
                  </div>

                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h2 className="text-2xl font-bold font-display text-foreground">
                      {feat.title}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      <ShieldCheck className="w-3 h-3" />
                      {feat.badge}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-6 flex-1">
                    {feat.description}
                  </p>

                  <div className="flex flex-wrap gap-3 mb-8">
                    {feat.metadata.map((m) => (
                      <span
                        key={m.label}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        <m.icon className="w-3.5 h-3.5" />
                        {m.label}
                      </span>
                    ))}
                  </div>

                  <Button
                    asChild
                    size="lg"
                    className={`w-full bg-gradient-to-r ${feat.gradient} hover:opacity-90 transition-opacity`}
                  >
                    <Link to={feat.link}>{feat.cta}</Link>
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Create;
