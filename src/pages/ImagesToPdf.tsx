import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import { ImagePreviewGrid } from "@/components/ImagePreviewGrid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Download, FileImage, Loader2, Settings2, RotateCcw, Sparkles,
  CheckCircle, ImagePlus, Layers, Zap, Shield, Monitor
} from "lucide-react";
import {
  createImageFile, generatePreview, convertImagesToPdf,
  formatFileSize, getTotalSize,
  type ImageFile, type ConversionOptions, type FitMode, type Orientation, type ImageQuality
} from "@/lib/imageConverter";
import { motion } from "framer-motion";

const PAGE_SIZES = ["A4", "A3", "A5", "Letter", "Legal", "Tabloid", "B5", "Executive"];

const ImagesToPdf = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [options, setOptions] = useState<ConversionOptions>({
    pageSize: "A4",
    orientation: "portrait",
    fitMode: "fit",
    quality: "high",
    margin: 10,
  });

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newImages = files.map(createImageFile);
    setImages((prev) => [...prev, ...newImages]);

    // Generate previews in background
    for (const imgFile of newImages) {
      const updated = await generatePreview(imgFile);
      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    images.forEach((img) => {
      if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview);
    });
    setImages([]);
  }, [images]);

  const handleConvert = async () => {
    if (images.length === 0) return;
    setConverting(true);
    setProgress({ current: 0, total: images.length });

    try {
      const blob = await convertImagesToPdf(images, options, (current, total) => {
        setProgress({ current, total });
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `images-to-pdf-${images.length}-pages.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Conversion failed:", err);
    } finally {
      setConverting(false);
    }
  };

  const totalSize = getTotalSize(images);
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const features = [
    { icon: ImagePlus, title: "25+ Formats", desc: "JPG, PNG, WebP, HEIC, TIFF, SVG, GIF, BMP, AVIF, PSD, RAW & more" },
    { icon: Layers, title: "100+ Images", desc: "Combine hundreds of images into a single PDF" },
    { icon: Zap, title: "Client-Side", desc: "Fast processing right in your browser — no upload to server" },
    { icon: Shield, title: "Private & Secure", desc: "Your images never leave your device" },
    { icon: Monitor, title: "Responsive", desc: "Works on desktop, tablet, and mobile" },
    { icon: Settings2, title: "Full Control", desc: "Page size, orientation, fit mode, quality — customize everything" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Image to PDF Converter — Convert 100+ Images to PDF | PDFly"
        description="Convert JPG, PNG, WebP, HEIC, TIFF, SVG and 25+ image formats into a single PDF. Supports 100+ images, drag-to-reorder, client-side processing. Free & private."
        keywords="image to PDF, JPG to PDF, PNG to PDF, HEIC to PDF, convert images to PDF, batch image to PDF, free PDF converter"
        canonical={`${SITE_URL}/images-to-pdf`}
      />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-12 md:py-20">
          <div className="absolute inset-0 dot-pattern opacity-50" />
          <div className="container mx-auto px-4 max-w-6xl relative">
            <motion.div
              className="text-center max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-4 text-sm px-4 py-1 bg-primary/10 text-primary border-0">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> New Feature
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-display tracking-tight mb-4">
                <span className="gradient-text">Image to PDF</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Convert 100+ images into a single PDF. Supports 25+ formats including HEIC, WebP, TIFF, SVG, RAW & more.
                <span className="block mt-1 text-sm font-medium text-primary">100% client-side — your images never leave your device</span>
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main converter area */}
        <section className="container mx-auto px-4 max-w-6xl pb-16">
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            {/* Left: Upload + Preview */}
            <div className="space-y-6">
              <ImageUploadZone
                onFilesSelected={handleFilesSelected}
                disabled={converting}
                imageCount={images.length}
              />

              <ImagePreviewGrid
                images={images}
                onRemove={handleRemove}
                onReorder={handleReorder}
                onClearAll={handleClearAll}
              />
            </div>

            {/* Right: Settings panel */}
            <div className="space-y-4">
              <Card className="p-5 sticky top-20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Settings2 className="w-4 h-4 text-primary" /> PDF Settings
                </h3>

                <div className="space-y-5">
                  {/* Page Size */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Page Size</label>
                    <Select
                      value={options.pageSize}
                      onValueChange={(v) => setOptions((o) => ({ ...o, pageSize: v }))}
                      disabled={converting}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Orientation */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Orientation</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["portrait", "landscape"] as Orientation[]).map((o) => (
                        <Button
                          key={o}
                          variant={options.orientation === o ? "default" : "outline"}
                          size="sm"
                          className="capitalize"
                          onClick={() => setOptions((opt) => ({ ...opt, orientation: o }))}
                          disabled={converting}
                        >
                          {o === "portrait" ? "↕ Portrait" : "↔ Landscape"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Fit Mode */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Image Fit</label>
                    <Select
                      value={options.fitMode}
                      onValueChange={(v) => setOptions((o) => ({ ...o, fitMode: v as FitMode }))}
                      disabled={converting}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fit">Fit to Page (keep ratio)</SelectItem>
                        <SelectItem value="fill">Fill Page (crop edges)</SelectItem>
                        <SelectItem value="original">Original Size</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quality */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Quality: <span className="text-foreground capitalize">{options.quality}</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["low", "medium", "high"] as ImageQuality[]).map((q) => (
                        <Button
                          key={q}
                          variant={options.quality === q ? "default" : "outline"}
                          size="sm"
                          className="capitalize text-xs"
                          onClick={() => setOptions((o) => ({ ...o, quality: q }))}
                          disabled={converting}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Margin */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Margin: {options.margin}mm
                    </label>
                    <Slider
                      value={[options.margin]}
                      onValueChange={([v]) => setOptions((o) => ({ ...o, margin: v }))}
                      min={0}
                      max={30}
                      step={1}
                      disabled={converting}
                    />
                  </div>

                  {/* Stats */}
                  {images.length > 0 && (
                    <div className="pt-3 border-t border-border space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Images</span>
                        <span className="font-medium text-foreground">{images.length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Size</span>
                        <span className="font-medium text-foreground">{formatFileSize(totalSize)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">PDF Pages</span>
                        <span className="font-medium text-foreground">{images.length}</span>
                      </div>
                    </div>
                  )}

                  {/* Progress */}
                  {converting && (
                    <div className="space-y-2">
                      <Progress value={progressPercent} className="h-2" />
                      <p className="text-xs text-center text-muted-foreground">
                        Processing {progress.current}/{progress.total} images...
                      </p>
                    </div>
                  )}

                  {/* Convert button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleConvert}
                    disabled={images.length === 0 || converting}
                  >
                    {converting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting...</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" /> Convert to PDF ({images.length} pages)</>
                    )}
                  </Button>

                  {totalSize > 500 * 1024 * 1024 && (
                    <p className="text-xs text-destructive text-center">
                      ⚠️ Total size exceeds 500MB. Performance may be affected.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="container mx-auto px-4 max-w-6xl pb-16">
          <h2 className="text-2xl font-bold font-display text-center mb-8">Why PDFly Image Converter?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="p-5 h-full hover:shadow-md transition-shadow border-border/60">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{f.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Supported formats */}
        <section className="container mx-auto px-4 max-w-4xl pb-16">
          <Card className="p-6 md:p-8">
            <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-primary" />
              Supported Image Formats (25+)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {[
                "JPG / JPEG", "PNG", "WebP", "GIF", "BMP", "SVG", "AVIF", "ICO",
                "HEIC", "HEIF", "TIFF / TIF", "JFIF", "JPEG 2000", "PSD",
                "CR2 (Canon RAW)", "NEF (Nikon RAW)", "ARW (Sony RAW)", "DNG (Adobe RAW)",
                "TGA", "PCX", "PPM", "PGM", "PBM", "WBMP", "CUR", "EXR", "HDR"
              ].map((fmt) => (
                <div key={fmt} className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg bg-secondary/50">
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-foreground font-medium">{fmt}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ImagesToPdf;
