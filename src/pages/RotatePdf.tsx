import { useState, useEffect } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RotatePdf = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [scope, setScope] = useState<"all" | "pick">("all");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  // pdf-lib page ops are cheap; still gate on device capability for very
  // large PDFs, same pattern as SplitPdf.
  const { plan, cloudConsent, setCloudConsent, blocked } = useProcessingPlan(files);

  useEffect(() => {
    setPicked(new Set());
    if (!files[0]) {
      setPageCount(null);
      return;
    }
    (async () => {
      const { getPdfPageCount } = await import("@/lib/pdfTools/toImages");
      setPageCount(await getPdfPageCount(files[0]));
    })();
  }, [files]);

  const togglePage = (n: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const handleRotate = async () => {
    if (!files[0]) return;
    if (scope === "pick" && picked.size === 0) {
      toast({ title: "Pick at least one page first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { rotatePdf } = await import("@/lib/pdfTools/pageOps");
      const blob = await rotatePdf(files[0], angle, scope === "pick" ? [...picked] : undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = files[0].name.replace(/\.pdf$/i, "_rotated.pdf");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Rotated!", description: `Rotated ${scope === "pick" ? picked.size : pageCount} page(s) by ${angle}°.` });
    } catch (e) {
      toast({ title: "Rotation failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PdfToolLayout
      slug="rotate-pdf"
      title="Rotate PDF"
      metaTitle="Rotate PDF Free — Fix Page Orientation in Browser | PDFly"
      metaDescription="Rotate PDF pages free online. Rotate every page or just the ones you pick, by 90, 180 or 270 degrees — 100% browser-based, no upload, no signup."
      tagline="Fix sideways or upside-down pages. Rotate the whole document or just the pages that need it — all inside your browser."
      faqs={[
        {
          q: "Will rotation apply to every page or just some?",
          a: "Your choice. Pick 'Rotate all pages' to fix the whole document, or 'Pick pages' to select only the ones that are sideways or upside-down.",
        },
        {
          q: "Can I rotate different pages by different amounts in one go?",
          a: "Not in a single pass — one rotation angle applies to all pages you've selected. Need different angles for different pages? Run the tool twice, picking a different set of pages each time.",
        },
        {
          q: "Does rotating lose any quality?",
          a: "No. Rotation only changes the page's orientation metadata — the underlying content isn't re-rendered or recompressed.",
        },
        { q: "Are my files uploaded?", a: "No. Rotation happens entirely in your browser using pdf-lib." },
      ]}
    >
      <PdfDropzone multiple={false} files={files} onFiles={setFiles} hint="Choose one PDF to rotate." />

      {files.length > 0 && (
        <div className="mt-6 space-y-5">
          {pageCount !== null && (
            <p className="text-sm text-muted-foreground">
              This PDF has <span className="font-semibold text-foreground">{pageCount}</span> pages.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {(["all", "pick"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 min-w-[9rem] text-left p-3 rounded-xl border transition-all ${
                  scope === s
                    ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span className="block text-sm font-semibold text-foreground">
                  {s === "all" ? "Rotate all pages" : "Pick pages"}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {s === "all" ? "Whole document" : "Choose which ones"}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-sm font-medium text-foreground mb-3">Rotate by</p>
            <div className="flex flex-wrap gap-2">
              {([90, 180, 270] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAngle(a)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors inline-flex items-center gap-1.5 ${
                    angle === a ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" /> {a}°
                </button>
              ))}
            </div>
          </div>

          {scope === "pick" && pageCount !== null && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">
                  Tap the pages to rotate ({picked.size} selected)
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPicked(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)))}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => togglePage(n)}
                    className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg text-sm font-mono border transition-colors ${
                      picked.has(n)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* cloudAvailable={false}: rotate/delete/reorder aren't implemented on
              the pdf-fallback function (only merge/split/compress/images-to-pdf
              are), so there's genuinely no cloud option to offer here. */}
          <CapabilityNotice plan={plan} cloudConsent={cloudConsent} onCloudConsentChange={setCloudConsent} cloudAvailable={false} />

          <Button onClick={handleRotate} disabled={busy || blocked || (scope === "pick" && picked.size === 0)} size="lg" className="w-full">
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <RotateCw className="w-5 h-5 mr-2" />}
            {busy
              ? "Rotating..."
              : blocked
              ? "File too large for this device"
              : `Rotate ${scope === "pick" ? picked.size || "" : pageCount ?? ""} page${(scope === "pick" ? picked.size : pageCount ?? 0) === 1 ? "" : "s"}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground -mt-2">
            <FileDown className="w-3 h-3 inline mr-1" /> Free · no watermark · no signup
          </p>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default RotatePdf;
