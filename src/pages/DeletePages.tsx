import { useState, useEffect } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toggleInSet } from "@/lib/utils";

const DeletePages = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
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

  const togglePage = (n: number) => setPicked((prev) => toggleInSet(prev, n));

  const remaining = pageCount !== null ? pageCount - picked.size : null;

  const handleDelete = async () => {
    if (!files[0]) return;
    if (picked.size === 0) {
      toast({ title: "Pick at least one page to remove", variant: "destructive" });
      return;
    }
    if (pageCount !== null && picked.size === pageCount) {
      toast({ title: "Can't remove every page", description: "Leave at least one page behind.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { deletePages } = await import("@/lib/pdfTools/pageOps");
      const blob = await deletePages(files[0], [...picked]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = files[0].name.replace(/\.pdf$/i, "_edited.pdf");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Pages removed!", description: `Removed ${picked.size} page(s), ${remaining} left.` });
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PdfToolLayout
      slug="delete-pdf-pages"
      title="Delete PDF Pages"
      metaTitle="Delete PDF Pages Free — Remove Pages in Browser | PDFly"
      metaDescription="Remove pages from a PDF free online. Pick the pages you don't want and delete them — 100% browser-based, no upload, no signup, no watermark."
      tagline="Pick the pages you don't need and drop them from the file. Everything happens in your browser."
      faqs={[
        {
          q: "Can I undo after downloading?",
          a: "Not through this tool — the download is a new file, and your original is untouched on your device. Just re-upload the original if you want to start over.",
        },
        {
          q: "Can I remove every page?",
          a: "No, you have to leave at least one page in the document. If you want nothing, just delete the file.",
        },
        {
          q: "What happens to page numbers after I delete pages?",
          a: "The remaining pages shift up to fill the gap — page 10 becomes page 9 if you delete page 5, for example. Any page numbers printed inside the PDF's content itself are not touched, only the document structure.",
        },
        { q: "Are my files uploaded?", a: "No. Deleting pages happens entirely in your browser using pdf-lib." },
      ]}
    >
      <PdfDropzone multiple={false} files={files} onFiles={setFiles} hint="Choose one PDF to edit." />

      {files.length > 0 && pageCount !== null && (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            This PDF has <span className="font-semibold text-foreground">{pageCount}</span> pages.
            Tap the ones you want to remove.
          </p>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">{picked.size} selected for removal</p>
              <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => togglePage(n)}
                  className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg text-sm font-mono border transition-colors ${
                    picked.has(n)
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border hover:border-destructive/40 text-muted-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 border border-border p-3.5">
            <p className="text-xs text-muted-foreground">
              You'll be left with{" "}
              <span className="font-semibold text-foreground">
                {remaining} page{remaining === 1 ? "" : "s"}
              </span>
              .
            </p>
          </div>

          {/* cloudAvailable={false}: rotate/delete/reorder aren't implemented on
              the pdf-fallback function (only merge/split/compress/images-to-pdf
              are), so there's genuinely no cloud option to offer here. */}
          <CapabilityNotice plan={plan} cloudConsent={cloudConsent} onCloudConsentChange={setCloudConsent} cloudAvailable={false} />

          <Button
            onClick={handleDelete}
            disabled={busy || blocked || picked.size === 0 || picked.size === pageCount}
            size="lg"
            className="w-full"
            variant="destructive"
          >
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
            {busy
              ? "Removing..."
              : blocked
              ? "File too large for this device"
              : `Remove ${picked.size || ""} page${picked.size === 1 ? "" : "s"}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground -mt-2">
            <FileDown className="w-3 h-3 inline mr-1" /> Free · no watermark · no signup
          </p>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default DeletePages;
