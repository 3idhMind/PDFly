/**
 * Deterministic cover art for a blog post, generated from its slug.
 *
 * Replaces hotlinked Unsplash photos. Two of the thirteen had already stopped
 * resolving — including the one on /blog/convert-images-to-pdf-free — because
 * a hotlinked stock photo is a URL on someone else's server that can be
 * rate-limited, moved or withdrawn without notice. The other eleven were one
 * policy change away from the same fate.
 *
 * Generic stock photography is also the visual half of the "written by a
 * machine" signal that DECISIONS D-015 bans in post copy. A generated mark tied
 * to the post's own slug is at least honestly ours.
 *
 * Returned as a data URI: no network request, nothing to 404, no layout shift.
 */

/** FNV-1a. Small, stable, and good enough to spread slugs across the wheel. */
function hash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * An SVG data URI, sized 800x400 to match the aspect ratio the old photos used
 * so no layout changes were needed.
 *
 * Hue comes from the slug, so a post keeps the same colour forever and two
 * adjacent posts in a list are very unlikely to collide. Saturation and
 * lightness are fixed to stay legible against both themes.
 */
export function blogCover(slug: string): string {
  const hue = hash(slug) % 360;
  const hue2 = (hue + 38) % 360;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 62% 46%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue2} 58% 32%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="800" height="400" fill="url(#g)"/>` +
    // Two soft discs, offset by the hash, so covers differ beyond just hue.
    `<circle cx="${640 + (hash(slug) % 60)}" cy="${90 + (hash(slug) % 40)}" r="150" fill="#fff" opacity="0.07"/>` +
    `<circle cx="${120 + (hash(slug) % 80)}" cy="${330 - (hash(slug) % 50)}" r="110" fill="#fff" opacity="0.05"/>` +
    `</svg>`;

  // encodeURIComponent rather than base64: smaller, and readable in devtools.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
