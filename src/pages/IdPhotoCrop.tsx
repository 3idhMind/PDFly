import { useState } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { resizeToTarget } from "@/lib/imageTools/resizeToTarget";
import { useToast } from "@/hooks/use-toast";
import { formatBytes as fmt } from "@/lib/utils";
import { Crop, Download, Loader2, Info, IdCard } from "lucide-react";

// 600 DPI is the standard PVC card print resolution; the pixel counts below
// are that DPI applied to each spec's physical size (cm converted via 1in = 2.54cm).
const PRESETS = {
  passport: { label: "Passport / PAN size (2×2 in)", width: 1200, height: 1200 },
  aadhaar: { label: "Aadhaar / Voter ID size (3.5×4.5 cm)", width: 827, height: 1063 },
} as const;
type PresetKey = keyof typeof PRESETS;

interface Result {
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
  hitFloor: boolean;
}

const IdPhotoCrop = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PresetKey>("passport");
  const [targetKB, setTargetKB] = useState(100);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const { toast } = useToast();

  const handleCrop = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const spec = PRESETS[preset];
      const { blob, width, height, hitFloor } = await resizeToTarget(file, {
        targetBytes: targetKB * 1024,
        exactWidth: spec.width,
        exactHeight: spec.height,
      });
      setResult({
        url: URL.createObjectURL(blob),
        name: file.name.replace(/\.\w+$/, "") + `_${preset}.jpg`,
        width,
        height,
        size: blob.size,
        hitFloor,
      });
      if (hitFloor) {
        toast({
          title: "Closest fit at readable quality",
          description: `Couldn't hit ${targetKB} KB without going below the readability floor — delivered ${fmt(blob.size)} instead.`,
        });
      } else {
        toast({ title: "Photo ready", description: `${width}×${height}px · ${fmt(blob.size)}` });
      }
    } catch (e) {
      toast({ title: "Crop failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PdfToolLayout
      slug="id-photo-crop"
      title="ID Photo Crop for PVC Card Printing"
      metaTitle="Aadhaar/PAN Photo Crop for PVC Printing — Free, In Your Browser | PDFly"
      metaDescription="Crop and resize a photo to exact Aadhaar, PAN, or Voter ID PVC card dimensions at 600 DPI. Centre-crop, exact pixel output, target file size. 100% browser-based, no upload."
      tagline="Crop a photo to the exact pixel dimensions PVC card printers expect for Aadhaar, PAN, or Voter ID — right in your browser."
      faqs={[
        {
          q: "What size does this produce?",
          a: "Passport/PAN preset outputs 1200×1200px (2×2 inch at 600 DPI). Aadhaar/Voter preset outputs 827×1063px (3.5×4.5 cm at 600 DPI, the size most PVC card printers ask for). Both are fixed by the printer spec, not adjustable by taste.",
        },
        {
          q: "Does this check if my photo meets biometric requirements?",
          a: "No. This tool only crops and resizes to the right dimensions and file size. It does not verify white background, no-glasses rules, face position, or any other biometric compliance requirement — those vary by registrar and you should check them yourself before printing.",
        },
        {
          q: "How does the crop decide what to keep?",
          a: "It centre-crops your photo to the target aspect ratio, then scales to the exact pixel size. If your subject isn't centred in the original photo, edges may get cut — check the preview before downloading.",
        },
        {
          q: "Do exact size requirements vary by state or registrar?",
          a: "Yes. Print size, DPI, and file-size limits differ across PVC card vendors and state portals. 600 DPI at these dimensions covers the common case, but confirm your specific portal's requirement before submitting.",
        },
        {
          q: "Will it always hit my target file size?",
          a: "It tries to, but never below a quality floor that would make the photo unreadable. If the target can't be hit without crossing that floor, you get the closest readable result instead — the tool tells you plainly when that happens, not a silent claim of success.",
        },
      ]}
    >
      <ImageUploadZone onFilesSelected={(f) => { setFile(f[0]); setResult(null); }} imageCount={file ? 1 : 0} disabled={busy} />
      <p className="text-xs text-muted-foreground mt-2">Only the first photo is used — this tool crops one photo at a time.</p>

      {file && (
        <>
          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium">Card size</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, spec]) => (
                <Button
                  key={key}
                  variant={preset === key ? "default" : "outline"}
                  className="justify-start h-auto py-3 text-left"
                  onClick={() => { setPreset(key); setResult(null); }}
                  disabled={busy}
                >
                  <div>
                    <div className="text-sm font-medium">{spec.label}</div>
                    <div className="text-xs opacity-70">{spec.width}×{spec.height}px</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2">Target file size: {targetKB} KB</p>
            <Slider value={[targetKB]} onValueChange={([v]) => setTargetKB(v)} min={20} max={300} step={10} disabled={busy} />
          </div>

          <Button onClick={handleCrop} disabled={busy} size="lg" className="w-full mt-5">
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crop className="w-5 h-5 mr-2" />}
            {busy ? "Cropping..." : "Crop to size"}
          </Button>
        </>
      )}

      {result && (
        <div className="mt-6 p-6 rounded-2xl border border-primary/30 bg-primary/5 text-center">
          <img src={result.url} alt="Cropped preview" className="mx-auto rounded-lg border border-border max-h-64 object-contain" />
          <p className="text-sm text-muted-foreground mt-4">{result.width}×{result.height}px · {fmt(result.size)}</p>

          {result.hitFloor && (
            <p className="mt-3 text-xs text-left rounded-xl border border-border bg-background/60 p-3 inline-flex items-start gap-2 text-foreground">
              <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              Couldn't reach {targetKB} KB without dropping below a readable quality floor — this is the closest fit that still looks right, not a silent miss.
            </p>
          )}

          <p className="mt-3 text-xs text-left rounded-xl border border-border bg-background/60 p-3 inline-flex items-start gap-2 text-muted-foreground">
            <IdCard className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            This only crops and resizes to the right dimensions — it doesn't check background, glasses, or other biometric rules your registrar may require.
          </p>

          <a href={result.url} download={result.name} className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Download className="w-4 h-4" /> Download
          </a>
        </div>
      )}
    </PdfToolLayout>
  );
};

export default IdPhotoCrop;
