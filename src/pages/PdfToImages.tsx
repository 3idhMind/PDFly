import { useState, useMemo } from "react";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { PdfDropzone } from "@/components/PdfDropzone";
import { CapabilityNotice } from "@/components/CapabilityNotice";
import { useProcessingPlan } from "@/hooks/useProcessingPlan";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PdfToImages = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState("150");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  // Rendering cost scales with the square of the resolution, so weight the
  // job size before asking the device-capability engine about it.
  const weightedBytes = useMemo(() => {
    const total = files.reduce((s, f) => s + f.size, 0);
    const scale = Math.pow(parseInt(dpi) / 150, 2);
    return Math.round(total * scale);
  }, [files, dpi]);
  const { plan } = useProcessingPlan(weightedBytes);


  const handleConvert = async () => {
    if (!files[0]) return;
    setBusy(true);
    try {
      const { pdfToImages } = await import("@/lib/pdfTools/toImages");
      const images = await pdfToImages(files[0], { format, dpi: parseInt(dpi), quality: 0.92 });
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      images.forEach((img) => zip.file(img.name, img.blob));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = files[0].name.replace(/\.pdf$/i, "_images.zip");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Converted!", description: `Exported ${images.length} images.` });
    } catch (e) {
      toast({ title: "Conversion failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <PdfToolLayout
      slug="pdf-to-images"
      title="PDF to Images"
      metaTitle="PDF to Images Free — Convert PDF to PNG/JPG | PDFly"
      metaDescription="Convert PDF to PNG or JPG images free. Every page becomes an image — 100% browser-based, no upload, no signup, no watermark."
      tagline="Turn every page of a PDF into a high-resolution PNG or JPG. Download as a zip — all local, all private."
      faqs={[
        { q: "What quality do I get?", a: "You choose the DPI — 150 is print-quality, 300 is archive-quality." },
        { q: "PNG or JPG?", a: "PNG preserves crisp text and transparency. JPG makes smaller files for photo-heavy PDFs." },
        { q: "Are my files uploaded?", a: "No. Rendering happens entirely in your browser using pdf.js." },
      ]}
    >
      <PdfDropzone multiple={false} files={files} onFiles={setFiles} hint="Choose one PDF to convert." />

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Format</span>
              <Select value={format} onValueChange={(v) => setFormat(v as "png" | "jpeg")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG (lossless)</SelectItem>
                  <SelectItem value="jpeg">JPG (smaller)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Resolution</span>
              <Select value={dpi} onValueChange={setDpi}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="72">72 DPI (screen)</SelectItem>
                  <SelectItem value="150">150 DPI (print)</SelectItem>
                  <SelectItem value="300">300 DPI (archive)</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <CapabilityNotice
            plan={plan}
            cloudConsent={false}
            onCloudConsentChange={() => {}}
            cloudAvailable={false}
          />
          {plan && plan.level !== "safe" && (
            <p className="text-xs text-muted-foreground">
              Tip: lower the resolution to 72 or 150 DPI to make this comfortably fit on your device.
            </p>
          )}

          <Button onClick={handleConvert} disabled={busy} size="lg" className="w-full">
            {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ImageIcon className="w-5 h-5 mr-2" />}
            {busy ? "Converting..." : "Convert to Images"}
          </Button>
          <p className="text-center text-xs text-muted-foreground -mt-2">
            <FileDown className="w-3 h-3 inline mr-1" /> Free · no watermark · no signup
          </p>
        </div>
      )}

    </PdfToolLayout>
  );
};

export default PdfToImages;
