import {
  Combine,
  Scissors,
  Minimize2,
  Image as ImageIcon,
  Images,
  FileText,
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
];
