import { useState } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { runInCloud, withCloudFallback } from "@/lib/cloudFallback";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, FileDown, Loader2, Combine, CloudCog, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";

const MergePdf = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { plan, cloudConsent, setCloudConsent, blocked } = useProcessingPlan(files);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: "Add at least 2 PDFs", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { result, usedCloud } = await withCloudFallback({
        allowCloud: cloudConsent,
        skipLocal: plan?.level === "too-large",
        local: async () => {
          const { mergePdfs } = await import("@/lib/pdfTools/merge");
          return [{ name: "merged.pdf", blob: await mergePdfs(files) }];
        },
        cloud: () => runInCloud("merge", files),
        onFallback: () =>
          toast({
            title: "Switching to secure cloud",
            description: "Too heavy for this device. Processed in memory and deleted instantly.",
          }),
      });
      const url = URL.createObjectURL(result[0].blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        title: "Merged!",
        description: `Combined ${files.length} PDFs ${usedCloud ? "via secure cloud" : "locally"}.`,
      });
    } catch (e) {
      toast({ title: "Merge failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PdfToolLayout
      slug="merge-pdf"
      title="Merge PDF"
      metaTitle="Merge PDF Free — Combine Multiple PDFs in Browser | PDFly"
      metaDescription="Merge PDF files free online. Combine unlimited PDFs into one — 100% browser-based, no upload, no signup, no watermark."
      tagline="Combine multiple PDFs into a single file. Drop them in, drag the order, download — all inside your browser."
      faqs={[
        { q: "How do I set the page order?", a: "Files merge top-to-bottom in the list below. Use the arrows next to each file to move it up or down before merging." },
        { q: "Is merging PDFs free?", a: "Yes. Unlimited merges, no signup, no watermark. Ever." },
        { q: "Are my files uploaded?", a: "No. Merging happens entirely in your browser. Only if your device can't handle the job and you tick the consent box will it run on our cloud — in memory, deleted instantly." },
        { q: "Is there a file-size limit?", a: "Only your device's memory. We check your device automatically and tell you before you hit a wall." },
      ]}
    >
      <PdfDropzone files={files} onFiles={setFiles} hint="Add 2 or more PDFs. They merge in the order shown below." />

      {files.length > 1 && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Merge order — top to bottom
            </p>
            <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear all
            </Button>
          </div>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card">
              <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-mono grid place-items-center shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 text-sm truncate">{f.name}</span>
              <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                {formatBytes(f.size)}
              </span>
              <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-9 sm:w-9 p-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-9 sm:w-9 p-0" onClick={() => move(i, 1)} disabled={i === files.length - 1} aria-label="Move down"><ArrowDown className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-9 sm:w-9 p-0" onClick={() => setFiles(files.filter((_, x) => x !== i))} aria-label="Remove"><X className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <CapabilityNotice plan={plan} cloudConsent={cloudConsent} onCloudConsentChange={setCloudConsent} />
      )}

      <Button onClick={handleMerge} disabled={busy || blocked || files.length < 2} size="lg" className="w-full mt-5">
        {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : blocked ? <CloudCog className="w-5 h-5 mr-2" /> : <Combine className="w-5 h-5 mr-2" />}
        {busy ? "Merging..." : blocked ? "Allow cloud processing to continue" : `Merge ${files.length || ""} PDFs`}
      </Button>
      <p className="text-center text-xs text-muted-foreground mt-2">
        <FileDown className="w-3 h-3 inline mr-1" /> Free · no watermark · no signup
      </p>
    </PdfToolLayout>
  );
};

export default MergePdf;
