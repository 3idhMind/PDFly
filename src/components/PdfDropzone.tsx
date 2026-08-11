import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

interface Props {
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  accept?: string;
  hint?: string;
}

export const PdfDropzone = ({ multiple = true, files, onFiles, accept = "application/pdf", hint }: Props) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const incoming = Array.from(list).filter((f) =>
        accept === "application/pdf" ? f.type === "application/pdf" || /\.pdf$/i.test(f.name) : true,
      );
      onFiles(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
    },
    [files, multiple, onFiles, accept],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
        }`}
      >
        <UploadCloud className="w-10 h-10 mx-auto mb-3 text-primary" />
        <p className="font-medium text-foreground">
          {multiple ? "Drop PDFs here or click to browse" : "Drop a PDF here or click to browse"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{hint || "100% local — nothing uploaded."}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 sm:h-9 sm:w-9 p-0 shrink-0"
                onClick={(e) => { e.stopPropagation(); onFiles(files.filter((_, idx) => idx !== i)); }}
                aria-label="Remove"
              >
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
