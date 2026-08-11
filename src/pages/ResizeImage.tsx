import { useEffect, useState } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, ImageDown, Info, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";
import type { ResizeToTargetResult } from "@/lib/imageTools/resizeToTarget";

const PHOTO_PRESETS = [20, 50, 100, 200];
const SIGNATURE_PRESETS = [10, 20, 50];
const LARGE_FILE_WARN_BYTES = 15 * 1024 * 1024;

interface Outcome extends ResizeToTargetResult {
  originalBytes: number;
  url: string;
  name: string;
}

interface Props {
  /**
   * Drives the three KB-preset landing pages, same pattern as CompressPdf's
   * presetKB prop: one component, one lazy chunk, route + prop pick the
   * default tab/target/copy. Only three fixed routes are asked for here (not
   * an open-ended range like the compress-pdf presets), so the copy below is
   * hardcoded per route rather than templated — simplest thing that works.
   */
  presetKB?: number;
  defaultTab?: "photo" | "signature";
}

const ResizeImage = ({ presetKB, defaultTab = "photo" }: Props = {}) => {
  const [tab, setTab] = useState<"photo" | "signature">(defaultTab);
  const [photoKB, setPhotoKB] = useState(defaultTab === "photo" && presetKB ? presetKB : 100);
  const [sigKB, setSigKB] = useState(defaultTab === "signature" && presetKB ? presetKB : 20);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const { toast } = useToast();

  const targetKB = tab === "photo" ? photoKB : sigKB;
  const setTargetKB = tab === "photo" ? setPhotoKB : setSigKB;
  const presets = tab === "photo" ? PHOTO_PRESETS : SIGNATURE_PRESETS;

  // Revoke the previous object URL whenever a new result replaces it, or the
  // component unmounts — otherwise each resize leaks a blob URL.
  useEffect(() => {
    return () => { if (result) URL.revokeObjectURL(result.url); };
  }, [result]);

  const handleResize = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const { resizeToTarget } = await import("@/lib/imageTools/resizeToTarget");
      const out = await resizeToTarget(file, { targetBytes: targetKB * 1024 });
      const base = file.name.replace(/\.[^.]+$/, "");
      setResult({
        ...out,
        originalBytes: file.size,
        url: URL.createObjectURL(out.blob),
        name: `${base}_${targetKB}kb.jpg`,
      });
      toast({
        title: out.hitFloor ? "Smallest readable result" : "Target reached",
        description: `${formatBytes(file.size)} → ${formatBytes(out.blob.size)}`,
      });
    } catch (e) {
      toast({ title: "Resize failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // Only three fixed routes exist, so branch directly rather than building a
  // slug/copy templating system for a range that isn't there.
  const isPhotoPreset = defaultTab === "photo" && presetKB === 20;
  const isSigPreset = defaultTab === "signature" && presetKB === 10;

  const slug = isPhotoPreset ? "compress-image-to-20kb" : isSigPreset ? "resize-signature-to-10kb" : "resize-image";
  const title = isPhotoPreset
    ? "Compress Image to 20KB"
    : isSigPreset
      ? "Resize Signature to 10KB"
      : "Resize Image to an Exact KB Size";
  const metaTitle = isPhotoPreset
    ? "Compress Image to 20KB Free — Photo Resizer | PDFly"
    : isSigPreset
      ? "Resize Signature to 10KB Free — Online Tool | PDFly"
      : "Resize Image to Exact KB — Photo & Signature | PDFly";
  const metaDescription = isPhotoPreset
    ? "Compress a JPG, PNG or HEIC photo to exactly 20KB or under. Best quality that still fits the limit. Runs in your browser, nothing uploaded."
    : isSigPreset
      ? "Resize a signature scan or photo to exactly 10KB or under, the size most application forms ask for. Runs in your browser, nothing uploaded."
      : "Resize a photo or signature to an exact KB target — 10KB to 200KB presets or any custom size. Runs in your browser, nothing uploaded.";
  const tagline = isPhotoPreset
    ? "Many forms cap photo uploads at 20KB. Drop your image and we compress it to fit at the best quality that still meets the limit."
    : isSigPreset
      ? "Most application and exam portals cap signature uploads at 10KB. Drop your scan and we compress it to fit."
      : "Pick a target size — 10KB to 200KB, or your own number — and we compress your photo or signature to fit, right in your browser.";

  const faqs = isPhotoPreset
    ? [
        { q: "Why do forms ask for a photo under 20KB?", a: "Many application and exam upload forms cap photo size to keep their systems light. 20KB is one of the most common limits." },
        { q: "How do I compress a photo to exactly 20KB?", a: "Drop your image — the target is already set to 20KB. Hit resize and the tool searches JPEG quality (and shrinks dimensions if needed) to fit under the limit." },
        { q: "Will the output ever be over 20KB?", a: "Only if 20KB isn't reachable without dropping below a quality floor that would make the photo unreadable. When that happens the tool says so plainly and gives you the smallest readable result instead." },
        { q: "Does this change my photo's dimensions?", a: "Only if quality alone can't hit 20KB — then it shrinks the image (keeping aspect ratio) and tries again. It never upscales." },
        { q: "What formats can I upload?", a: "JPG, PNG, HEIC (iPhone photos) and WebP. The output is always JPEG, since that's what photo-upload forms expect." },
      ]
    : isSigPreset
      ? [
          { q: "Why do portals want a 10KB signature?", a: "10KB is a common cap for scanned-signature uploads on application and exam forms — small enough to keep their systems light." },
          { q: "How do I get my signature under 10KB?", a: "Drop your signature image — the target is already set to 10KB. Hit resize and the tool searches quality and, if needed, shrinks the image to fit." },
          { q: "My signature is a photo of paper, not a scan — does that matter?", a: "No, it works the same way. Larger or noisier photos may need more shrinking to reach 10KB, which the tool handles automatically." },
          { q: "Should I use the Photo tab or Signature tab?", a: "Same engine either way — the Signature tab just pre-selects presets tuned to signature-upload limits (10KB, 20KB, 50KB) instead of photo limits." },
          { q: "Will heavy compression blur my signature?", a: "The tool stops lowering quality at a floor meant to keep strokes legible, even if that means the file lands a bit over 10KB. It tells you plainly when that happens instead of pretending the target was hit." },
        ]
      : [
          { q: "What's the difference between the Photo and Signature tabs?", a: "Same resizing engine — the tabs just switch the preset KB buttons to the sizes each use case actually asks for: 20-200KB for photos, 10-50KB for signatures. Pick whichever matches your form." },
          { q: "Does this crop my image or force a specific size?", a: "No. It only lowers quality, and if needed shrinks the image, to reach your KB target. Aspect ratio is preserved and the image is never upscaled." },
          { q: "What if my target can't be reached?", a: "The tool has a quality floor it won't go below, since an unreadable file is worse than an oversized one. If your target can't be hit above that floor, it says so and gives you the smallest readable result instead of silently missing the target." },
          { q: "What formats can I upload?", a: "JPG, PNG, HEIC (iPhone photos) and WebP. Output is always JPEG." },
          { q: "Is my photo uploaded anywhere?", a: "No. Resizing runs on your device via canvas — the file never leaves your browser." },
        ];

  return (
    <PdfToolLayout slug={slug} title={title} metaTitle={metaTitle} metaDescription={metaDescription} tagline={tagline} faqs={faqs}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "photo" | "signature")}>
        <TabsList className="grid grid-cols-2 w-full max-w-xs mx-auto">
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6">
        <ImageUploadZone
          imageCount={file ? 1 : 0}
          onFilesSelected={(files) => {
            setFile(files[0]);
            setResult(null);
          }}
          disabled={busy}
        />
      </div>

      {file && (
        <>
          {file.size > LARGE_FILE_WARN_BYTES && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> That's a large file ({formatBytes(file.size)}) — resizing may take a moment.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap gap-2">
              {presets.map((kb) => (
                <Button
                  key={kb}
                  type="button"
                  size="sm"
                  variant={targetKB === kb ? "default" : "outline"}
                  onClick={() => setTargetKB(kb)}
                  disabled={busy}
                  className="h-11 sm:h-9"
                >
                  {kb}KB
                </Button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="target-kb" className="text-xs text-muted-foreground">Custom target (KB)</Label>
                <Input
                  id="target-kb"
                  type="number"
                  min={1}
                  value={targetKB}
                  onChange={(e) => setTargetKB(Math.max(1, Number(e.target.value) || 1))}
                  disabled={busy}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleResize} disabled={busy} size="lg" className="w-full mt-5">
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ImageDown className="w-5 h-5 mr-2" />}
            {busy ? "Resizing…" : `Resize to ${targetKB}KB`}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-2">Free · no watermark · no signup</p>
        </>
      )}

      {result && (
        <div className="mt-6 p-6 rounded-2xl border border-primary/30 bg-primary/5 text-center">
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
            <div>
              <p className="text-sm text-muted-foreground">Original</p>
              <p className="text-xl font-semibold">{formatBytes(result.originalBytes)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resized</p>
              <p className="text-xl font-semibold text-primary">{formatBytes(result.blob.size)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dimensions</p>
              <p className="text-sm font-medium">{result.width} × {result.height}px</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quality used</p>
              <p className="text-sm font-medium">{Math.round(result.quality * 100)}%</p>
            </div>
          </div>

          <div className="mt-4 text-xs text-left max-w-sm mx-auto rounded-xl border border-border bg-background/60 p-3">
            {result.hitFloor ? (
              <p className="inline-flex items-start gap-2 text-foreground">
                <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                Couldn't hit {targetKB}KB without going below a readable quality floor. This is the
                smallest result we'd actually recommend — {formatBytes(result.blob.size)}.
              </p>
            ) : (
              <p className="inline-flex items-start gap-2 text-foreground">
                <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                Target met, at the best quality that still fits under {targetKB}KB.
              </p>
            )}
          </div>

          <a href={result.url} download={result.name} className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Download className="w-4 h-4" /> Download
          </a>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default ResizeImage;
