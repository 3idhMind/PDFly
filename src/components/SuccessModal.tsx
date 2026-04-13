import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { formatBytes } from "@/lib/pdfGenerator";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfs: Array<{ title: string; url: string; sizeBytes: number }>;
}

export const SuccessModal = ({ isOpen, onClose, pdfs }: SuccessModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-6 h-6" />
            {pdfs.length} PDF{pdfs.length !== 1 ? 's' : ''} Generated! 🎉
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-muted-foreground text-sm">
            Your documents have been generated. View, download, or print them from the preview section below.
          </p>

          <div className="bg-secondary/50 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
            {pdfs.map((pdf, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdf.title}.pdf</span>
                </div>
                <span className="text-muted-foreground text-xs shrink-0 ml-2">{formatBytes(pdf.sizeBytes)}</span>
              </div>
            ))}
          </div>

          <Button onClick={onClose} className="w-full">
            View PDFs
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
