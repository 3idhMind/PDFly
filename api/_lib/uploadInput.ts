/**
 * Pure input checks for the chunked uploader.
 *
 * Split out of handlers/upload.ts and deliberately importing nothing: these are
 * the parts with security consequences (a path segment and a type gate), and
 * keeping them dependency-free is what lets uploadInput.test.ts exercise them
 * with `node` and no build step, the same way apiKeys.test.ts does.
 */

/**
 * An upload id becomes a storage path segment.
 *
 * Anything that could climb out of the caller's own prefix is refused outright
 * rather than sanitised: a rejected id makes the client pick another one, while
 * a silently rewritten id would let two different uploads collide on the same
 * key and interleave their parts.
 */
export function cleanId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return /^[A-Za-z0-9_-]{8,64}$/.test(raw) ? raw : null;
}

/**
 * A filename is only ever shown back to the user and used in Content-
 * Disposition, so here sanitising is right — a caller should not lose an upload
 * because their file had a space in the name.
 */
export function cleanFilename(raw: unknown): string {
  const base = typeof raw === "string" && raw.trim() ? raw.trim() : "upload.pdf";
  const safe = base.replace(/[^\w.-]/g, "_").slice(-80);
  return /\.[a-z0-9]{2,5}$/i.test(safe) ? safe : `${safe}.pdf`;
}

/**
 * PNG, JPEG, GIF, WebP, BMP — the formats pdf-lib and the browser tools accept.
 *
 * Checked because an upload slot that takes any bytes at all is free object
 * storage for whoever finds it. Magic bytes, not the filename: the extension is
 * caller-supplied and proves nothing.
 */
export function looksLikeImage(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // GIF
  if (b[0] === 0x42 && b[1] === 0x4d) return true; // BMP
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true;
  return false;
}

/** %PDF within the first KB. Mirrors assertLooksLikePdf without the throw. */
export function looksLikePdf(b: Uint8Array): boolean {
  const head = b.subarray(0, 1024);
  for (let i = 0; i <= head.length - 4; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) {
      return true;
    }
  }
  return false;
}
