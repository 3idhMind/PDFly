/**
 * Resize an image to fit an exact byte-size target, and optionally an exact
 * pixel size too. This is the single engine behind:
 *   - the standalone "compress image to KB" tool
 *   - the signature resizer (KB target, no dimension constraint)
 *   - exam photo/signature crop (KB target AND exact width/height, e.g. SSC's
 *     "10-20KB, 3.5x4.5cm")
 *
 * Everything runs in-browser via canvas. No upload, matching the rest of the
 * product. HEIC input is converted through the same path imageConverter.ts
 * already uses, so there is one HEIC code path in the app, not two.
 */

import { isHeic, convertHeicToJpeg, loadImage, fileToDataUrl } from "@/lib/imageConverter";

export interface ResizeToTargetOptions {
  /** Hard ceiling in bytes. The result is guaranteed <= this (floor-permitting — see result.hitFloor). */
  targetBytes: number;
  /**
   * Exact output pixel dimensions, e.g. for a government photo spec.
   * When set, the source is centre-cropped to this aspect ratio then scaled
   * to these exact dimensions — the output is always exactly this size.
   * When omitted, the image keeps its aspect ratio and is only shrunk as
   * needed to reach targetBytes.
   */
  exactWidth?: number;
  exactHeight?: number;
  /**
   * Quality never drops below this even if the target can't be hit — a
   * result nobody would accept is worse than one that's a bit over target.
   * Most exam portals reject unreadable photos as readily as oversized ones.
   */
  minQuality?: number;
  /** JPEG only. Government portals uniformly require JPEG for photos/signatures. */
  mimeType?: "image/jpeg";
}

export interface ResizeToTargetResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  /** True if minQuality was hit before targetBytes was — the output may exceed targetBytes. */
  hitFloor: boolean;
}

const DEFAULT_MIN_QUALITY = 0.35;
/** Each downscale step shrinks the canvas by this factor before re-searching quality. */
const DOWNSCALE_STEP = 0.85;
/** Below this many px on the short side, stop downscaling — output is unusable regardless of size. */
const MIN_DIMENSION = 80;

function drawToCanvas(
  img: HTMLImageElement,
  outW: number,
  outH: number,
  exact: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  if (!exact) {
    ctx.drawImage(img, 0, 0, outW, outH);
    return canvas;
  }

  // Centre-crop to the target aspect ratio, then scale to exactly fill it —
  // required for exam specs (a 3:4 photo can't just be squashed into it).
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = outW / outH;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (srcRatio > dstRatio) {
    sw = Math.round(img.naturalHeight * dstRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
  } else {
    sh = Math.round(img.naturalWidth / dstRatio);
    sy = Math.round((img.naturalHeight - sh) / 2);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encoding failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Binary search over JPEG quality at fixed dimensions. ~10 iterations
 * converges within ~0.1% quality — plenty for a byte-size target.
 */
async function searchQuality(
  canvas: HTMLCanvasElement,
  targetBytes: number,
  minQuality: number,
): Promise<{ blob: Blob; quality: number }> {
  let lo = minQuality;
  let hi = 0.95;
  let best: { blob: Blob; quality: number } | null = null;

  // Quality 0.95 might already fit (small/simple image) — check the fast path first.
  const atHigh = await canvasToBlob(canvas, hi);
  if (atHigh.size <= targetBytes) return { blob: atHigh, quality: hi };

  const atLow = await canvasToBlob(canvas, lo);
  if (atLow.size > targetBytes) {
    // Even the floor quality doesn't fit at this resolution — caller must downscale.
    return { blob: atLow, quality: lo };
  }
  best = { blob: atLow, quality: lo };

  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, mid);
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

export async function resizeToTarget(
  file: File,
  opts: ResizeToTargetOptions,
): Promise<ResizeToTargetResult> {
  const minQuality = opts.minQuality ?? DEFAULT_MIN_QUALITY;

  let source: File | Blob = file;
  if (isHeic(file.type, file.name)) {
    source = await convertHeicToJpeg(file);
  }
  const dataUrl = await fileToDataUrl(source);
  const img = await loadImage(dataUrl);

  const exact = opts.exactWidth != null && opts.exactHeight != null;
  let outW = opts.exactWidth ?? img.naturalWidth;
  let outH = opts.exactHeight ?? img.naturalHeight;

  // Non-exact mode: never upscale — start from the source's own dimensions.
  if (!exact) {
    outW = img.naturalWidth;
    outH = img.naturalHeight;
  }

  for (;;) {
    const canvas = drawToCanvas(img, outW, outH, exact);
    const { blob, quality } = await searchQuality(canvas, opts.targetBytes, minQuality);

    const fitsAtFloor = blob.size <= opts.targetBytes;
    const shortSide = Math.min(outW, outH);
    const canShrinkMore = !exact && shortSide > MIN_DIMENSION;

    if (fitsAtFloor || !canShrinkMore) {
      return { blob, width: outW, height: outH, quality, hitFloor: !fitsAtFloor };
    }

    // Didn't fit even at minQuality — shrink dimensions and search again.
    // Exact-dimension mode can't shrink (the spec demands a fixed size), so it
    // falls through to hitFloor:true instead of silently disobeying the spec.
    outW = Math.max(MIN_DIMENSION, Math.round(outW * DOWNSCALE_STEP));
    outH = Math.max(MIN_DIMENSION, Math.round(outH * DOWNSCALE_STEP));
  }
}
