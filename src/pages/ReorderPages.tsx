import { useState, useEffect } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, FileDown, Loader2, ListOrdered } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ReorderPages = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { plan, cloudConsent, setCloudConsent, blocked } = useProcessingPlan(files);

  useEffect(() => {
    if (!files[0]) {
      setOrder([]);
      return;
    }
    (async () => {
      const { getPdfPageCount } = await import("@/lib/pdfTools/toImages");
      const n = await getPdfPageCount(files[0]);
      setOrder(Array.from({ length: n }, (_, i) => i + 1));
    })();
  }, [files]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const isUnchanged = order.every((n, i) => n === i + 1);

  const handleReorder = async () => {
    if (!files[0] || order.length === 0) return;
    setBusy(true);
    try {
      const { reorderPages } = await import("@/lib/pdfTools/pageOps");
      const blob = await reorderPages(files[0], order);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = files[0].name.replace(/\.pdf$/i, "_reordered.pdf");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Reordered!", description: `Rebuilt ${order.length} pages in the new order.` });
    } catch (e) {
      toast({ title: "Reorder failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PdfToolLayout
      slug="reorder-pdf-pages"
      title="Reorder PDF Pages"
      metaTitle="Reorder PDF Pages Free — Rearrange Pages in Browser | PDFly"
      metaDescription="Rearrange the pages of a PDF free online. Move pages up or down into any order you want — 100% browser-based, no upload, no signup, no watermark."
      tagline="Move pages into the order you actually want. Nudge them up or down, then download the rebuilt PDF."
      faqs={[
        {
          q: "Is there a limit to how many pages I can reorder?",
          a: "No hard limit from the tool itself — it's bounded by what your device can hold in memory, the same as any PDF you open here. The page list scrolls, so documents with hundreds of pages are still usable, just slower to nudge one at a time.",
        },
        {
          q: "Can I drag pages instead of clicking arrows?",
          a: "Not currently — use the up/down arrows next to each page. It's slower for big reshuffles but doesn't risk a mis-drop.",
        },
        {
          q: "Does reordering change the page content?",
          a: "No. Pages are copied as-is into the new order — nothing inside a page is modified.",
        },
        { q: "Are my files uploaded?", a: "No. Reordering happens entirely in your browser using pdf-lib." },
      ]}
    >
      <PdfDropzone multiple={false} files={files} onFiles={setFiles} hint="Choose one PDF to reorder." />

      {order.length > 1 && (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{order.length}</span> pages. Original page
            number shown on each row — use the arrows to move it.
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {order.map((pageNum, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card">
                <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-mono grid place-items-center shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm">
                  Page <span className="font-mono font-medium text-foreground">{pageNum}</span>
                </span>
                <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-9 sm:w-9 p-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-9 sm:w-9 p-0" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* cloudAvailable={false}: rotate/delete/reorder aren't implemented on
              the pdf-fallback function (only merge/split/compress/images-to-pdf
              are), so there's genuinely no cloud option to offer here. */}
          <CapabilityNotice plan={plan} cloudConsent={cloudConsent} onCloudConsentChange={setCloudConsent} cloudAvailable={false} />

          <Button onClick={handleReorder} disabled={busy || blocked || isUnchanged} size="lg" className="w-full">
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ListOrdered className="w-5 h-5 mr-2" />}
            {busy
              ? "Rebuilding..."
              : blocked
              ? "File too large for this device"
              : isUnchanged
              ? "Move a page to enable download"
              : "Download reordered PDF"}
          </Button>
          <p className="text-center text-xs text-muted-foreground -mt-2">
            <FileDown className="w-3 h-3 inline mr-1" /> Free · no watermark · no signup
          </p>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default ReorderPages;
