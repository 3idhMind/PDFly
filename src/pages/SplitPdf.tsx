import { useState, useEffect, useMemo } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { runInCloud, withCloudFallback } from "@/lib/cloudFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2, Scissors, Plus, X, CloudCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toggleInSet } from "@/lib/utils";

type Mode = "every" | "pick" | "ranges";

interface RangeRow {
  id: string;
  from: string;
  to: string;
}

const newRow = (from = "", to = ""): RangeRow => ({ id: crypto.randomUUID(), from, to });

const SplitPdf = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("every");
  const [everyN, setEveryN] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<RangeRow[]>([newRow("1", "5")]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { plan, cloudConsent, setCloudConsent, blocked } = useProcessingPlan(files);

  useEffect(() => {
    setPicked(new Set());
    setRows([newRow("1", "5")]);
    if (!files[0]) {
      setPageCount(null);
      return;
    }
    (async () => {
      const { getPdfPageCount } = await import("@/lib/pdfTools/toImages");
      setPageCount(await getPdfPageCount(files[0]));
    })();
  }, [files]);

  // Build the range string the engine understands from the friendly UI state.
  const ranges = useMemo(() => {
    if (!pageCount) return "";
    if (mode === "every") {
      const parts: string[] = [];
      for (let start = 1; start <= pageCount; start += everyN) {
        const end = Math.min(start + everyN - 1, pageCount);
        parts.push(start === end ? `${start}` : `${start}-${end}`);
      }
      return parts.join(", ");
    }
    if (mode === "pick") {
      return [...picked].sort((a, b) => a - b).join(", ");
    }
    return rows
      .map((r) => {
        const a = parseInt(r.from);
        const b = parseInt(r.to || r.from);
        if (isNaN(a)) return "";
        if (isNaN(b) || b === a) return `${a}`;
        return `${Math.min(a, b)}-${Math.max(a, b)}`;
      })
      .filter(Boolean)
      .join(", ");
  }, [mode, everyN, picked, rows, pageCount]);

  const outputCount = ranges ? ranges.split(",").filter((s) => s.trim()).length : 0;

  const togglePage = (n: number) => setPicked((prev) => toggleInSet(prev, n));

  const download = (name: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const deliver = async (parts: { name: string; blob: Blob }[]) => {
    if (parts.length === 1) {
      download(parts[0].name, parts[0].blob);
      return;
    }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    parts.forEach((p) => zip.file(p.name, p.blob));
    download("split_pdfs.zip", await zip.generateAsync({ type: "blob" }));
  };

  const handleSplit = async () => {
    if (!files[0]) return;
    if (!ranges) {
      toast({ title: "Pick the pages you want first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { result, usedCloud } = await withCloudFallback({
        allowCloud: cloudConsent,
        skipLocal: plan?.level === "too-large",
        local: async () => {
          const { splitPdf } = await import("@/lib/pdfTools/split");
          return splitPdf(files[0], ranges);
        },
        cloud: () => runInCloud("split", [files[0]], { ranges }),
        onFallback: () =>
          toast({
            title: "Switching to secure cloud",
            description: "Too heavy for this device. Processed in memory and deleted instantly.",
          }),
      });
      await deliver(result);
      toast({
        title: "Split complete",
        description: `Created ${result.length} file${result.length > 1 ? "s" : ""}${usedCloud ? " via secure cloud" : " locally"}.`,
      });
    } catch (e) {
      toast({ title: "Split failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const modeBtn = (id: Mode, label: string, sub: string) => (
    <button
      key={id}
      onClick={() => setMode(id)}
      className={`flex-1 min-w-[9rem] text-left p-3 rounded-xl border transition-all ${
        mode === id
          ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
          : "border-border hover:border-primary/40"
      }`}
    >
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="block text-xs text-muted-foreground mt-0.5">{sub}</span>
    </button>
  );

  return (
    <PdfToolLayout
      slug="split-pdf"
      title="Split PDF"
      metaTitle="Split PDF Free — Extract Pages in Browser | PDFly"
      metaDescription="Split PDF free online. Extract page ranges from any PDF — 100% browser-based, no upload, no signup, no watermark."
      tagline="Extract pages the easy way: split every N pages, tap the pages you want, or build custom ranges. No syntax to learn."
      faqs={[
        {
          q: "How do I split a PDF into separate parts?",
          a: "Upload your PDF, then choose a mode. 'Split every N pages' chops the whole file into equal chunks. 'Pick pages' lets you tap the exact page numbers you want. 'Custom ranges' lets you add rows like 1–5, 6–10, 11–20 — each row becomes its own PDF.",
        },
        {
          q: "Can I create several ranges at once?",
          a: "Yes. In Custom ranges, click 'Add range' as many times as you like. Add 1–5, then 6–10, then 11–20 — you'll get three separate PDFs downloaded together in a zip.",
        },
        { q: "Do my files leave my device?", a: "No. Splitting happens entirely in your browser. Only if your device can't handle the file and you tick the consent box will it be processed on our cloud — in memory, deleted instantly." },
        { q: "Can I split a large PDF?", a: "Yes. Large files are handled locally when your device can manage it, with a secure cloud fallback offered otherwise." },
      ]}
    >
      <PdfDropzone multiple={false} files={files} onFiles={setFiles} hint="Choose one PDF to split." />

      {files.length > 0 && (
        <div className="mt-6 space-y-5">
          {pageCount !== null && (
            <p className="text-sm text-muted-foreground">
              This PDF has <span className="font-semibold text-foreground">{pageCount}</span> pages.
              Choose how you'd like to split it.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {modeBtn("every", "Split every N pages", "Equal chunks, one click")}
            {modeBtn("pick", "Pick pages", "Tap the pages you want")}
            {modeBtn("ranges", "Custom ranges", "e.g. 1–5, 6–10, 11–20")}
          </div>

          {mode === "every" && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-sm font-medium text-foreground mb-3">Pages per file</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 5, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEveryN(n)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      everyN === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {n === 1 ? "1 page each" : `${n} pages`}
                  </button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={pageCount ?? 1}
                  value={everyN}
                  onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                  aria-label="Custom pages per file"
                />
              </div>
            </div>
          )}

          {mode === "pick" && pageCount !== null && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">
                  Tap the pages you want ({picked.size} selected)
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
              <p className="text-xs text-muted-foreground mt-3">Each selected page becomes its own PDF.</p>
            </div>
          )}

          {mode === "ranges" && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <p className="text-sm font-medium text-foreground">
                Each row becomes one PDF. Need pages 1–5, 6–10 and 11–20? Add three rows.
              </p>
              {rows.map((r, i) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-10">File {i + 1}</span>
                  <Input
                    type="number"
                    min={1}
                    max={pageCount ?? undefined}
                    value={r.from}
                    placeholder="from"
                    onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, from: e.target.value } : x)))}
                    className="w-20 sm:w-24"
                    aria-label={`Range ${i + 1} start page`}
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="number"
                    min={1}
                    max={pageCount ?? undefined}
                    value={r.to}
                    placeholder="to"
                    onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, to: e.target.value } : x)))}
                    className="w-20 sm:w-24"
                    aria-label={`Range ${i + 1} end page`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((p) => (p.length > 1 ? p.filter((x) => x.id !== r.id) : p))}
                    disabled={rows.length === 1}
                    aria-label="Remove range"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setRows((p) => [...p, newRow()])}>
                <Plus className="w-4 h-4 mr-1.5" /> Add range
              </Button>
            </div>
          )}

          <div className="rounded-xl bg-muted/40 border border-border p-3.5">
            <p className="text-xs text-muted-foreground">
              You'll get{" "}
              <span className="font-semibold text-foreground">
                {outputCount} PDF{outputCount === 1 ? "" : "s"}
              </span>
              {outputCount > 1 && " (downloaded together as a zip)"}
              {ranges && (
                <>
                  {" "}· pages <span className="font-mono text-foreground">{ranges}</span>
                </>
              )}
            </p>
          </div>

          <CapabilityNotice
            plan={plan}
            cloudConsent={cloudConsent}
            onCloudConsentChange={setCloudConsent}
          />

          <Button onClick={handleSplit} disabled={busy || blocked || outputCount === 0} size="lg" className="w-full">
            {busy ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : blocked ? (
              <CloudCog className="w-5 h-5 mr-2" />
            ) : (
              <Scissors className="w-5 h-5 mr-2" />
            )}
            {busy ? "Splitting..." : blocked ? "Allow cloud processing to continue" : `Split into ${outputCount || ""} PDF${outputCount === 1 ? "" : "s"}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground -mt-2">
            <FileDown className="w-3 h-3 inline mr-1" />
            Free · no watermark · no signup
          </p>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default SplitPdf;
