import {
  Combine,
  Scissors,
  Minimize2,
  Image as ImageIcon,
  Images,
  FileText,
  Crop,
  RotateCw,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";

export interface ToolEntry {
  href: string;
  slug: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  accepts: string;
}

export const TOOLS: ToolEntry[] = [
  {
    href: "/merge-pdf",
    slug: "merge-pdf",
    label: "Merge PDF",
    desc: "Combine multiple PDFs into one file, in any order.",
    icon: Combine,
    accepts: "PDF files",
  },
  {
    href: "/split-pdf",
    slug: "split-pdf",
    label: "Split PDF",
    desc: "Extract pages, split every N pages, or build custom ranges.",
    icon: Scissors,
    accepts: "One PDF",
  },
  {
    href: "/compress-pdf",
    slug: "compress-pdf",
    label: "Compress PDF",
    desc: "Shrink file size for email and uploads without losing quality.",
    icon: Minimize2,
    accepts: "One PDF",
  },
  {
    href: "/pdf-to-images",
    slug: "pdf-to-images",
    label: "PDF to Images",
    desc: "Turn every page into a PNG or JPG and download as a zip.",
    icon: ImageIcon,
    accepts: "One PDF",
  },
  {
    href: "/images-to-pdf",
    slug: "images-to-pdf",
    label: "Images to PDF",
    desc: "Bundle photos and scans into a single tidy PDF.",
    icon: Images,
    accepts: "JPG, PNG, WebP, HEIC…",
  },
  {
    href: "/app",
    slug: "app",
    label: "Text to PDF",
    desc: "Beautiful, multi-language PDFs from plain text — 15 templates.",
    icon: FileText,
    accepts: "Text",
  },
  {
    href: "/resize-image",
    slug: "resize-image",
    label: "Resize Image to KB",
    desc: "Shrink a photo or signature to an exact KB target — for exam and portal uploads.",
    icon: Minimize2,
    accepts: "JPG, PNG, HEIC…",
  },
  {
    href: "/id-photo-crop",
    slug: "id-photo-crop",
    label: "ID Photo Crop",
    desc: "Crop a photo to exact Aadhaar/PAN/Voter ID dimensions for PVC printing.",
    icon: Crop,
    accepts: "One photo",
  },
  {
    href: "/rotate-pdf",
    slug: "rotate-pdf",
    label: "Rotate PDF",
    desc: "Fix sideways or upside-down pages — rotate all or just the ones you pick.",
    icon: RotateCw,
    accepts: "One PDF",
  },
  {
    href: "/delete-pdf-pages",
    slug: "delete-pdf-pages",
    label: "Delete PDF Pages",
    desc: "Remove the pages you don't want, keep the rest exactly as they were.",
    icon: Scissors,
    accepts: "One PDF",
  },
  {
    href: "/reorder-pdf-pages",
    slug: "reorder-pdf-pages",
    label: "Reorder PDF Pages",
    desc: "Move pages up or down into the order you actually want.",
    icon: ListOrdered,
    accepts: "One PDF",
  },
];
