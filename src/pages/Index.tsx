import { useState, useCallback, useEffect } from "react";
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
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

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

    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please log in to generate PDFs",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsGenerating(true);
    setProgressCurrent(0);
    setProgressTotal(nonEmpty.length);
    setProgressStage("Sending to server...");

    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: {
          documents: nonEmpty.map((d) => ({ title: d.title, content: d.content })),
          language,
          template: selectedTemplate,
          page_size: pageSize,
        },
      });

      if (error) {
        throw new Error(error.message || "Function invocation failed");
      }

      if (!data?.success) {
        throw new Error(data?.message || "PDF generation failed on server");
      }

      if (Array.isArray((data as any).warnings) && (data as any).warnings.length) {
        toast({
          title: "Rendering Notice",
          description: (data as any).warnings.join(" • "),
        });
      }

      setProgressCurrent(nonEmpty.length);
      setProgressStage("Complete!");

      const pdfs = (data.documents as Array<{
        title: string;
        download_url: string;
        size_bytes: number;
      }>).map((d) => ({
        title: d.title.replace(/\.pdf$/, ""),
        url: d.download_url,
        sizeBytes: d.size_bytes,
      }));

      setGeneratedPdfs(pdfs);
      setIsGenerating(false);
      setShowSuccess(true);
    } catch (err: unknown) {
      console.error("PDF generation failed:", err);
      setIsGenerating(false);
      const message =
        err instanceof Error ? err.message : "Something went wrong generating your PDFs";
      toast({ title: "Generation Failed", description: message, variant: "destructive" });
    }
  }, [documents, selectedTemplate, pageSize, language, toast, isLoggedIn, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-foreground mb-3">
            <span className="gradient-text">PDFly</span> Generator
          </h1>
          <p className="text-lg text-muted-foreground">
            Convert any content to beautiful PDFs — any document, any language, any template
          </p>
        </div>

        <TemplateSelector selectedTemplate={selectedTemplate} onTemplateChange={setSelectedTemplate} />

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
