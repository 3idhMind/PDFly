import { useCallback, useRef, useState } from "react";
import { Upload, ImagePlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPT_STRING, SUPPORTED_EXTENSIONS } from "@/lib/imageConverter";
import { motion, AnimatePresence } from "framer-motion";

interface ImageUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  imageCount: number;
}

export const ImageUploadZone = ({ onFilesSelected, disabled, imageCount }: ImageUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const valid = files.filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return f.type.startsWith("image/") || SUPPORTED_EXTENSIONS.includes(ext);
    });
    if (valid.length < files.length) {
      setDragError(`${files.length - valid.length} unsupported file(s) skipped`);
      setTimeout(() => setDragError(""), 3000);
    }
    if (valid.length > 0) onFilesSelected(valid);
  }, [onFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  return (
    <div className="space-y-3">
      <motion.div
        className={`
          relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer
          transition-all duration-300 group
          ${isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={!disabled ? { scale: 1.005 } : {}}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_STRING}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-4">
          <div className={`
            p-4 rounded-2xl transition-colors duration-300
            ${isDragging ? "bg-primary/10" : "bg-secondary group-hover:bg-primary/10"}
          `}>
            {imageCount > 0 ? (
              <ImagePlus className="w-10 h-10 text-primary" />
            ) : (
              <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>

          <div>
            <p className="text-lg font-semibold text-foreground">
              {imageCount > 0 ? "Add More Images" : "Drop images here or click to upload"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports 25+ formats: JPG, PNG, WebP, HEIC, TIFF, SVG, GIF, BMP, AVIF, PSD, RAW & more
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload 100+ images at once • Max 500MB total
            </p>
          </div>

          <Button variant="outline" size="sm" disabled={disabled} className="mt-2">
            <ImagePlus className="w-4 h-4 mr-2" />
            Browse Files
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {dragError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg"
          >
            <AlertCircle className="w-4 h-4" />
            {dragError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
