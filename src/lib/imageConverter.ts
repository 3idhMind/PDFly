import { jsPDF } from "jspdf";

export interface ImageFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview: string;
  width?: number;
  height?: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
}

export type FitMode = "fit" | "fill" | "original";
export type Orientation = "portrait" | "landscape";
export type ImageQuality = "low" | "medium" | "high";

export interface ConversionOptions {
  pageSize: string;
  orientation: Orientation;
  fitMode: FitMode;
  quality: ImageQuality;
  margin: number; // in mm
}

// Page size dimensions in mm
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Tabloid: { width: 279.4, height: 431.8 },
  B5: { width: 176, height: 250 },
  Executive: { width: 184.15, height: 266.7 },
};

const QUALITY_MAP: Record<ImageQuality, number> = {
  low: 0.5,
  medium: 0.75,
  high: 0.95,
};

// All supported MIME types and extensions
export const SUPPORTED_FORMATS = [
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp",
  "image/webp", "image/svg+xml", "image/avif", "image/ico", "image/x-icon",
  "image/tiff", "image/tif", "image/heic", "image/heif",
  "image/jfif", "image/pjpeg", "image/pjp",
  "image/jp2", "image/jpeg2000",
  "image/x-portable-pixmap", "image/x-portable-graymap", "image/x-portable-bitmap",
  "image/x-tga", "image/x-pcx", "image/vnd.wap.wbmp",
  "image/x-cur",
];

export const SUPPORTED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg",
  ".avif", ".ico", ".tiff", ".tif", ".heic", ".heif", ".jfif",
  ".jp2", ".jpeg2000", ".ppm", ".pgm", ".pbm", ".tga", ".pcx",
  ".wbmp", ".cur", ".psd", ".cr2", ".nef", ".arw", ".dng",
  ".exr", ".hdr",
];

export const ACCEPT_STRING = SUPPORTED_EXTENSIONS.join(",") + "," + SUPPORTED_FORMATS.join(",");

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

export function createImageFile(file: File): ImageFile {
  return {
    id: generateId(),
    file,
    name: file.name,
    size: file.size,
    type: file.type || guessTypeFromExtension(file.name),
    preview: "",
    status: "pending",
  };
}

function guessTypeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
    ico: "image/x-icon", tiff: "image/tiff", tif: "image/tiff",
    heic: "image/heic", heif: "image/heif", jfif: "image/jfif",
    psd: "image/vnd.adobe.photoshop", cr2: "image/x-canon-cr2",
    nef: "image/x-nikon-nef", arw: "image/x-sony-arw", dng: "image/x-adobe-dng",
  };
  return map[ext || ""] || "image/unknown";
}

function isHeic(type: string, name: string): boolean {
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(result) ? result[0] : result;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function generatePreview(imageFile: ImageFile): Promise<ImageFile> {
  try {
    let blob: File | Blob = imageFile.file;
    if (isHeic(imageFile.type, imageFile.name)) {
      blob = await convertHeicToJpeg(imageFile.file);
    }
    const dataUrl = await fileToDataUrl(blob);
    const img = await loadImage(dataUrl);
    return {
      ...imageFile,
      preview: dataUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
      status: "pending",
    };
  } catch (e) {
    // Fallback: try raw object URL
    const url = URL.createObjectURL(imageFile.file);
    try {
      const img = await loadImage(url);
      return {
        ...imageFile,
        preview: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        status: "pending",
      };
    } catch {
      return { ...imageFile, status: "error", error: `Cannot preview: ${(e as Error).message}` };
    }
  }
}

export async function convertImagesToPdf(
  images: ImageFile[],
  options: ConversionOptions,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const pageDims = PAGE_SIZES[options.pageSize] || PAGE_SIZES.A4;
  const isLandscape = options.orientation === "landscape";
  const pageW = isLandscape ? pageDims.height : pageDims.width;
  const pageH = isLandscape ? pageDims.width : pageDims.height;
  const margin = options.margin;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const jpegQuality = QUALITY_MAP[options.quality];

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  const BATCH_SIZE = 10;

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage([pageW, pageH], isLandscape ? "landscape" : "portrait");

    const imgFile = images[i];
    onProgress?.(i + 1, images.length);

    try {
      let blob: File | Blob = imgFile.file;
      if (isHeic(imgFile.type, imgFile.name)) {
        blob = await convertHeicToJpeg(imgFile.file);
      }

      const dataUrl = await fileToDataUrl(blob);
      const img = await loadImage(dataUrl);

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;

      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (options.fitMode === "fit") {
        const scale = Math.min(contentW / imgW, contentH / imgH);
        drawW = imgW * scale;
        drawH = imgH * scale;
        drawX = margin + (contentW - drawW) / 2;
        drawY = margin + (contentH - drawH) / 2;
      } else if (options.fitMode === "fill") {
        const scale = Math.max(contentW / imgW, contentH / imgH);
        drawW = imgW * scale;
        drawH = imgH * scale;
        drawX = margin + (contentW - drawW) / 2;
        drawY = margin + (contentH - drawH) / 2;
      } else {
        // original size (in mm, 1px ≈ 0.2646mm at 96dpi)
        const pxToMm = 25.4 / 96;
        drawW = Math.min(imgW * pxToMm, contentW);
        drawH = Math.min(imgH * pxToMm, contentH);
        drawX = margin + (contentW - drawW) / 2;
        drawY = margin + (contentH - drawH) / 2;
      }

      // Render to canvas for quality control
      const canvas = document.createElement("canvas");
      const maxDim = 4096;
      const cScale = Math.min(1, maxDim / Math.max(imgW, imgH));
      canvas.width = Math.round(imgW * cScale);
      canvas.height = Math.round(imgH * cScale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const format = imgFile.type === "image/png" ? "PNG" : "JPEG";
      const imgData = canvas.toDataURL(
        format === "PNG" ? "image/png" : "image/jpeg",
        jpegQuality
      );

      pdf.addImage(imgData, format, drawX, drawY, drawW, drawH);

      // Memory cleanup
      canvas.width = 0;
      canvas.height = 0;

      // Yield to UI thread every batch
      if ((i + 1) % BATCH_SIZE === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      // Add error page
      pdf.setFontSize(14);
      pdf.setTextColor(200, 50, 50);
      pdf.text(`Error loading: ${imgFile.name}`, margin, margin + 20);
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text((err as Error).message || "Unknown error", margin, margin + 30);
    }
  }

  onProgress?.(images.length, images.length);
  return pdf.output("blob");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function getTotalSize(images: ImageFile[]): number {
  return images.reduce((sum, img) => sum + img.size, 0);
}
