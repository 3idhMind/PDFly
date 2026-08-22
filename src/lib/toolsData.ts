/**
 * The tool list, as plain data.
 *
 * Split out of `toolsList.ts` because that file imports lucide-react icons, and
 * `scripts/postbuild.mjs` runs under Node where a React import cannot be
 * resolved. The consequence was that the prerenderer — the only thing a crawler
 * without JavaScript ever sees — had no access to the one authoritative list of
 * what this site actually does. Keep this file free of imports.
 */

export interface ToolData {
  href: string;
  slug: string;
  label: string;
  desc: string;
  /** What the tool takes, in the words shown to a person. */
  accepts: string;
}

export const TOOLS_DATA: ToolData[] = [
  {
    href: "/merge-pdf",
    slug: "merge-pdf",
    label: "Merge PDF",
    desc: "Combine multiple PDFs into one file, in any order.",
    accepts: "PDF files",
  },
  {
    href: "/split-pdf",
    slug: "split-pdf",
    label: "Split PDF",
    desc: "Extract pages, split every N pages, or build custom ranges.",
    accepts: "One PDF",
  },
  {
    href: "/compress-pdf",
    slug: "compress-pdf",
    label: "Compress PDF",
    desc: "Shrink file size for email and uploads without losing quality.",
    accepts: "One PDF",
  },
  {
    href: "/pdf-to-images",
    slug: "pdf-to-images",
    label: "PDF to Images",
    desc: "Turn every page into a PNG or JPG and download as a zip.",
    accepts: "One PDF",
  },
  {
    href: "/images-to-pdf",
    slug: "images-to-pdf",
    label: "Images to PDF",
    desc: "Bundle photos and scans into a single tidy PDF.",
    accepts: "JPG, PNG, WebP, HEIC…",
  },
  {
    href: "/app",
    slug: "app",
    label: "Text to PDF",
    desc: "Beautiful, multi-language PDFs from plain text — 15 templates.",
    accepts: "Text",
  },
  {
    href: "/resize-image",
    slug: "resize-image",
    label: "Resize Image to KB",
    desc: "Shrink a photo or signature to an exact KB target — for exam and portal uploads.",
    accepts: "JPG, PNG, HEIC…",
  },
  {
    href: "/id-photo-crop",
    slug: "id-photo-crop",
    label: "ID Photo Crop",
    desc: "Crop a photo to exact Aadhaar/PAN/Voter ID dimensions for PVC printing.",
    accepts: "One photo",
  },
  {
    href: "/rotate-pdf",
    slug: "rotate-pdf",
    label: "Rotate PDF",
    desc: "Fix sideways or upside-down pages — rotate all or just the ones you pick.",
    accepts: "One PDF",
  },
  {
    href: "/delete-pdf-pages",
    slug: "delete-pdf-pages",
    label: "Delete PDF Pages",
    desc: "Remove the pages you don't want, keep the rest exactly as they were.",
    accepts: "One PDF",
  },
  {
    href: "/reorder-pdf-pages",
    slug: "reorder-pdf-pages",
    label: "Reorder PDF Pages",
    desc: "Move pages up or down into the order you actually want.",
    accepts: "One PDF",
  },
];

/** Lookup by route path, for the prerenderer and anything else keyed on URL. */
export const toolByHref = (href: string): ToolData | undefined =>
  TOOLS_DATA.find((t) => t.href === href);

/**
 * Exam pages a given tool should point at.
 *
 * STRATEGY.md picked exact-KB uploads for Indian exam portals as the one gap to
 * win, and listed this as its own open item: the exam pages linked down to the
 * tools, nothing linked back up, so the cluster was a fan rather than a web.
 * Someone who lands on the resizer mid-rejection is exactly the person who
 * needs the page explaining what the portal actually requires.
 *
 * Keyed by tool slug. Lives here, with no imports, so the prerenderer can read
 * it as well as the React layout.
 */
export interface RelatedGuide {
  href: string;
  label: string;
  blurb: string;
}

export const EXAM_GUIDES: Record<string, RelatedGuide[]> = {
  "resize-signature-to-10kb": [
    {
      href: "/exam/ssc-signature-size",
      label: "SSC CGL signature size for 2026",
      blurb: "The notification gives two different dimensions. Here is both, and which one to use.",
    },
    {
      href: "/exam/upsc-photo-signature-size",
      label: "UPSC photo and signature sizes",
      blurb: "Signature 20-100KB at 350-500px, and why a file can be rejected for being too small.",
    },
  ],
  "compress-image-to-20kb": [
    {
      href: "/exam/ssc-signature-size",
      label: "SSC CGL 2026 photo and signature specs",
      blurb: "CGL 2026 has no photo upload step at all. Here is what is actually required.",
    },
    {
      href: "/exam/upsc-photo-signature-size",
      label: "UPSC photo size (20-200KB)",
      blurb: "The portal enforces a minimum as well as a maximum.",
    },
  ],
  "resize-image": [
    {
      href: "/exam/upsc-photo-signature-size",
      label: "UPSC photo and signature sizes",
      blurb: "Photo 20-200KB, signature 20-100KB, certificates 50-300KB.",
    },
    {
      href: "/exam/ssc-signature-size",
      label: "SSC CGL signature size for 2026",
      blurb: "10-20KB JPEG, with the dimension conflict explained.",
    },
  ],
  "id-photo-crop": [
    {
      href: "/exam/upsc-photo-signature-size",
      label: "UPSC photo requirements",
      blurb: "Dimensions and file size the portal accepts, including the minimums.",
    },
  ],
};

export const guidesForSlug = (slug: string): RelatedGuide[] => EXAM_GUIDES[slug] ?? [];
