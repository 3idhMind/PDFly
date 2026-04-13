import { X, AlertCircle, GripVertical, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, type ImageFile } from "@/lib/imageConverter";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useState } from "react";

interface ImagePreviewGridProps {
  images: ImageFile[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClearAll: () => void;
}

export const ImagePreviewGrid = ({ images, onRemove, onReorder, onClearAll }: ImagePreviewGridProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDrop = useCallback((index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  if (images.length === 0) return null;

  const getFormatBadge = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase() || "IMG";
    return ext;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {images.length} image{images.length !== 1 ? "s" : ""} selected
          <span className="text-muted-foreground ml-2">
            (Drag to reorder • This order = PDF page order)
          </span>
        </p>
        <Button variant="ghost" size="sm" onClick={onClearAll} className="text-destructive hover:text-destructive">
          Clear All
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <AnimatePresence>
          {images.map((img, index) => (
            <motion.div
              key={img.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: draggedIndex === index ? 0.5 : 1,
                scale: 1,
                borderColor: dragOverIndex === index ? "hsl(var(--primary))" : "transparent",
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className={`
                relative group rounded-xl border-2 overflow-hidden bg-card
                cursor-grab active:cursor-grabbing
                ${dragOverIndex === index ? "border-primary ring-2 ring-primary/20" : "border-border"}
              `}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              {/* Page number badge */}
              <div className="absolute top-1.5 left-1.5 z-10">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-background/80 backdrop-blur-sm font-mono">
                  {index + 1}
                </Badge>
              </div>

              {/* Drag handle */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
                className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
              >
                <X className="w-3 h-3" />
              </button>

              {/* Image preview */}
              <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
                {img.preview ? (
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : img.status === "error" ? (
                  <div className="flex flex-col items-center gap-1 p-2 text-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                    <p className="text-[10px] text-destructive">{img.error || "Error"}</p>
                  </div>
                ) : (
                  <FileImage className="w-8 h-8 text-muted-foreground animate-pulse" />
                )}
              </div>

              {/* Info bar */}
              <div className="px-2 py-1.5 bg-card border-t border-border">
                <p className="text-[11px] font-medium text-foreground truncate" title={img.name}>
                  {img.name}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatFileSize(img.size)}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                    {getFormatBadge(img.name)}
                  </Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
