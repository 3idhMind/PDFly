import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { InputSection } from "@/components/InputSection";
import { ControlPanel } from "@/components/ControlPanel";
import { PDFPreview } from "@/components/PDFPreview";
import { ProgressModal } from "@/components/ProgressModal";
import { SuccessModal } from "@/components/SuccessModal";
import { TemplateSelector } from "@/components/TemplateSelector";
import { Footer } from "@/components/Footer";

import { useToast } from "@/hooks/use-toast";
import { DocumentSection } from "@/types/pdf";
import { Button } from "@/components/ui/button";
import { Plus, ShieldCheck, Lock, Wifi, Sparkles } from "lucide-react";
import { generatePdfsClient } from "@/lib/clientPdfGenerator";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";

const createDoc = (title = "Untitled Document"): DocumentSection => ({
  id: crypto.randomUUID(),
  title,
  content: "",
});

const Index = () => {
  const [documents, setDocuments] = useState<DocumentSection[]>([createDoc("Document 1")]);
  const [language, setLanguage] = useState("auto");
  const [pageSize, setPageSize] = useState("A4");
  const [selectedTemplate, setSelectedTemplate] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedPdfs, setGeneratedPdfs] = useState<
    Array<{ title: string; url: string; sizeBytes: number }>
  >([]);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Revoke old blob URLs when PDFs are replaced/unmounted
  useEffect(() => {
    return () => {
      generatedPdfs.forEach((p) => {
        if (p.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
    };
  }, [generatedPdfs]);

  const addDocument = () => {
    if (documents.length >= 5) {
      toast({
        title: "Limit Reached",
        description: "Maximum 5 documents at once",
        variant: "destructive",
      });
      return;
    }
    setDocuments((prev) => [...prev, createDoc(`Document ${prev.length + 1}`)]);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDocTitle = (id: string, title: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)));
  };

  const updateDocContent = (id: string, content: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, content } : d)));
  };

  const handleGenerate = useCallback(async () => {
    const nonEmpty = documents.filter((d) => d.content.trim());
    if (nonEmpty.length === 0) {
      toast({
        title: "Input Required",
        description: "Please enter content for at least one document",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProgressCurrent(0);
    setProgressTotal(nonEmpty.length);
    setProgressStage("Generating in your browser...");

    try {
      const pdfs = await generatePdfsClient({
        documents: nonEmpty,
        template: selectedTemplate,
        pageSize,
        language,
        onProgress: (current, total, stage) => {
          setProgressCurrent(current);
          setProgressTotal(total);
          setProgressStage(stage);
        },
      });

      setGeneratedPdfs(pdfs.map((p) => ({ title: p.title, url: p.url, sizeBytes: p.sizeBytes })));
      setIsGenerating(false);
      setShowSuccess(true);
    } catch (err: unknown) {
      console.error("Client PDF generation failed:", err);
      setIsGenerating(false);
      const message =
        err instanceof Error ? err.message : "Something went wrong generating your PDFs";
      toast({ title: "Generation Failed", description: message, variant: "destructive" });
    }
  }, [documents, selectedTemplate, pageSize, language, toast]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Text to PDF — Free Online Text to PDF Converter | PDFly"
        description="Convert text to PDF free in your browser. 15 templates, 11 page sizes, no upload, no watermark, no signup for basic use."
        canonical={`${SITE_URL}/app`}

      />
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-foreground mb-3">
            <span className="gradient-text">Text to PDF</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Turn plain text into a beautiful PDF — 15 templates, right in your browser. Nothing is uploaded.
          </p>
        </div>


        {/* Privacy badge */}
        <div className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                100% Local · Browser-Only Processing
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Zero Upload
                </span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your text never leaves your device. Nothing is uploaded, stored, or logged. No login required.
              </p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3 text-primary" /> Zero leak</span>
                <span className="inline-flex items-center gap-1"><Wifi className="w-3 h-3 text-primary" /> Works offline</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-primary" /> No account needed</span>
              </div>
            </div>
          </div>
        </div>

        <TemplateSelector selectedTemplate={selectedTemplate} onTemplateChange={setSelectedTemplate} />

        <div className="mb-2 flex justify-end">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary border border-primary/20">
            <Sparkles className="w-3 h-3" /> Completely Free · No limits · No watermark
          </span>
        </div>
        <ControlPanel
          language={language}
          setLanguage={setLanguage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          onGenerate={handleGenerate}
          disabled={isGenerating}
        />

        <div className="grid md:grid-cols-2 gap-6 mb-4">
          {documents.map((doc, idx) => (
            <InputSection
              key={doc.id}
              id={doc.id}
              title={doc.title}
              value={doc.content}
              onTitleChange={(t) => updateDocTitle(doc.id, t)}
              onContentChange={(c) => updateDocContent(doc.id, c)}
              onRemove={() => removeDocument(doc.id)}
              canRemove={documents.length > 1}
              language={language}
              index={idx}
            />
          ))}
        </div>

        <Button onClick={addDocument} variant="outline" className="w-full mb-8 border-dashed border-2 h-14 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          <Plus className="w-5 h-5 mr-2" />
          Add Document ({documents.length}/5)
        </Button>

        {generatedPdfs.length > 0 && (
          <PDFPreview pdfs={generatedPdfs} />
        )}
      </main>

      <ProgressModal isOpen={isGenerating} current={progressCurrent} total={progressTotal} stage={progressStage} />
      <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} pdfs={generatedPdfs} />
      <Footer />
    </div>
  );
};

export default Index;
