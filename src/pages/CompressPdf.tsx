import { useEffect, useState } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { CompressControls } from "@/components/CompressControls";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { runInCloud, withCloudFallback } from "@/lib/cloudFallback";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileDown, Loader2, Minimize2, CloudCog, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PdfAnalysis } from "@/lib/pdfTools/analyzePdf";
import type { CompressProgress, CompressResult, QualityFloor } from "@/lib/pdfTools/compress";

const fmt = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(2)} MB`;

interface Outcome {
  before: number;
  after: number;
  url: string;
  name: string;
  qualityUsed: string;
  rasterized: boolean;
  targetMet: boolean;
  usedCloud: boolean;
}

const CompressPdf = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [targetBytes, setTargetBytes] = useState(0);
  const [quality, setQuality] = useState<QualityFloor>("balanced");
  const [progress, setProgress] = useState<CompressProgress | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { plan, cloudConsent, setCloudConsent, blocked } = useProcessingPlan(files);

  // Analyse as soon as a file lands so the controls are anchored to reality.
  useEffect(() => {
    let cancelled = false;
    const file = files[0];
    setAnalysis(null);
    setResult(null);
    if (!file) return;
    setAnalyzing(true);
    (async () => {
      try {
        const { analyzePdf } = await import("@/lib/pdfTools/analyzePdf");
        const a = await analyzePdf(file);
        if (cancelled) return;
        setAnalysis(a);
        const suggested = Math.max(a.floorBytes, Math.round(a.bytes * 0.35));
        setTargetBytes(Math.min(suggested, a.bytes));
      } catch (e) {
        if (!cancelled) toast({ title: "Could not read that PDF", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const handleCompress = async () => {
    if (!files[0]) return;
    setBusy(true);
    setResult(null);
    setProgress({ phase: "lossless" });
    try {
      const before = files[0].size;
      const name = files[0].name.replace(/\.pdf$/i, "_compressed.pdf");

      const { result: out, usedCloud } = await withCloudFallback<CompressResult>({
        allowCloud: cloudConsent,
        skipLocal: plan?.level === "too-large",
        local: async () => {
          const { compressPdf } = await import("@/lib/pdfTools/compress");
          return compressPdf(files[0], {
            targetBytes,
            qualityFloor: quality,
            onProgress: setProgress,
          });
        },
        cloud: async () => {
          const parts = await runInCloud("compress", [files[0]], {
            targetBytes,
            qualityFloor: quality,
          });
          return {
            blob: parts[0].blob,
            originalBytes: before,
            outputBytes: parts[0].blob.size,
            qualityUsed: "Lossless (cloud)",
            rasterized: false,
            targetMet: parts[0].blob.size <= targetBytes,
            pages: analysis?.pages ?? 0,
          };
        },
        onFallback: () =>
          toast({
            title: "Switching to secure cloud",
            description: "Too heavy for this device. Processed in memory and deleted instantly.",
          }),
      });

      setResult({
        before,
        after: out.outputBytes,
        url: URL.createObjectURL(out.blob),
        name,
        qualityUsed: out.qualityUsed,
        rasterized: out.rasterized,
        targetMet: out.targetMet,
        usedCloud,
      });
      toast({
        title: out.targetMet ? "Target reached" : "Compressed as far as possible",
        description: `${fmt(before)} → ${fmt(out.outputBytes)}${usedCloud ? " (secure cloud)" : ""}`,
      });
    } catch (e) {
      toast({ title: "Compression failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pct = result ? Math.max(0, Math.round(((result.before - result.after) / result.before) * 100)) : 0;
  const renderPct =
    progress?.phase === "rendering" && progress.total
      ? Math.round(((progress.page ?? 0) / progress.total) * 100)
      : null;

  const progressLabel =
    progress?.phase === "lossless"
      ? "Optimising structure (lossless pass)…"
      : progress?.phase === "estimating"
        ? "Finding the best quality that fits your target…"
        : progress?.phase === "rendering"
          ? `Re-encoding page ${progress.page} of ${progress.total} · ${progress.note}`
          : progress?.phase === "assembling"
            ? "Assembling your PDF…"
            : "";

  return (
    <PdfToolLayout
      slug="compress-pdf"
      title="Compress PDF"
      metaTitle="Compress PDF to a Target Size — Free, In Your Browser | PDFly"
      metaDescription="Compress PDF to 10 MB, 5 MB, or any size you choose. Pick your target, we deliver the best quality that fits. 100% browser-based, no upload, no signup."
      tagline="Stuck on a 10 MB upload limit? Name the size you need — we hit it at the best quality that fits, right in your browser."
      faqs={[
        { q: "How do I get a PDF under 10 MB?", a: "Drop the file, tap the 'Under 10 MB' preset, and hit compress. The tool searches quality settings and delivers the best-looking file that still fits under your target." },
        { q: "How much can I actually save?", a: "Scanned documents and photo-heavy PDFs typically shrink 80–95%. Text-based PDFs are already compact — expect 5–15%, because the content itself is the floor. The tool tells you which kind of file you have before you start." },
        { q: "Does compression lose quality?", a: "The first pass is fully lossless. Only if that doesn't reach your target do we re-encode page images — and we always stop at the highest quality that still fits, never lower." },
        { q: "Will text still be selectable?", a: "Yes on the lossless pass. When deep compression is needed, pages are re-encoded as images, so the text layer is replaced — we tell you clearly when that happens." },
        { q: "Is my file uploaded?", a: "No. Everything runs in your browser. Only if your device can't handle the file and you tick the consent box does it run on our cloud — in memory, deleted instantly, never stored." },
      ]}
    >
      <PdfDropzone
        multiple={false}
        files={files}
        onFiles={(f) => setFiles(f)}
        hint="Choose one PDF to compress."
      />

      {analyzing && (
        <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Analysing your PDF…
        </p>
      )}

      {files.length > 0 && analysis && (
        <>
          <CompressControls
            analysis={analysis}
            targetBytes={targetBytes}
            onTargetChange={setTargetBytes}
            quality={quality}
            onQualityChange={setQuality}
            disabled={busy}
          />

          <CapabilityNotice plan={plan} cloudConsent={cloudConsent} onCloudConsentChange={setCloudConsent} />

          <Button onClick={handleCompress} disabled={busy || blocked} size="lg" className="w-full mt-5">
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : blocked ? <CloudCog className="w-5 h-5 mr-2" /> : <Minimize2 className="w-5 h-5 mr-2" />}
            {busy ? "Compressing..." : blocked ? "Allow cloud processing to continue" : `Compress to ${fmt(targetBytes)}`}
          </Button>

          {busy && (
            <div className="mt-4">
              <Progress value={renderPct ?? undefined} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-2 text-center">{progressLabel}</p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-2">
            <FileDown className="w-3 h-3 inline mr-1" /> Free · no watermark · no signup
          </p>
        </>
      )}

      {result && (
        <div className="mt-6 p-6 rounded-2xl border border-primary/30 bg-primary/5 text-center">
          <p className="text-sm text-muted-foreground">Original</p>
          <p className="text-xl font-semibold">{fmt(result.before)}</p>
          <p className="text-sm text-muted-foreground mt-3">Compressed</p>
          <p className="text-3xl font-display font-bold text-primary">{fmt(result.after)}</p>
          <p className="text-sm text-primary/80 mt-1">{pct}% smaller · quality: {result.qualityUsed}</p>

          <div className="mt-4 text-xs text-left rounded-xl border border-border bg-background/60 p-3 space-y-1.5">
            {result.targetMet ? (
              <p className="inline-flex items-start gap-2 text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                Target met — and we stopped at the best quality that fits, not the smallest possible.
              </p>
            ) : (
              <p className="inline-flex items-start gap-2 text-foreground">
                <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                {fmt(result.after)} is the best achievable for this file at your quality floor.
                {analysis?.kind === "text"
                  ? " This is a text-based PDF — the content itself is the limit. Lowering quality won't help; splitting it will."
                  : " Try a lower quality floor, or split the document into parts."}
              </p>
            )}
            {result.rasterized && (
              <p className="text-muted-foreground">
                Deep compression was needed, so pages were re-encoded as images — text is no longer selectable.
              </p>
            )}
            {result.usedCloud && (
              <p className="text-muted-foreground">
                Processed on our secure cloud in memory. Nothing was stored or logged.
              </p>
            )}
          </div>

          <a href={result.url} download={result.name} className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <FileDown className="w-4 h-4" /> Download
          </a>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default CompressPdf;
