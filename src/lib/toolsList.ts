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
import { TOOLS_DATA, type ToolData } from "./toolsData";

/**
 * The tool list with its icons attached.
 *
 * The strings live in `toolsData.ts`, which has no imports so that Node can
 * read it during the build. This file is the React-facing half and exists only
 * to pair each entry with a component. Adding a tool means editing the data
 * file and adding one line to ICONS below.
 */

export interface ToolEntry extends ToolData {
  icon: LucideIcon;
}

const ICONS: Record<string, LucideIcon> = {
  "merge-pdf": Combine,
  "split-pdf": Scissors,
  "compress-pdf": Minimize2,
  "pdf-to-images": ImageIcon,
  "images-to-pdf": Images,
  "app": FileText,
  "resize-image": Minimize2,
  "id-photo-crop": Crop,
  "rotate-pdf": RotateCw,
  "delete-pdf-pages": Scissors,
  "reorder-pdf-pages": ListOrdered,
};

export const TOOLS: ToolEntry[] = TOOLS_DATA.map((t) => ({ ...t, icon: ICONS[t.slug] }));
