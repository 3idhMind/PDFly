import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { FileText, CheckCircle2 } from "lucide-react";

interface ProgressModalProps {
  isOpen: boolean;
  current: number;
  total: number;
  stage: string;
}

export const ProgressModal = ({ isOpen, current, total, stage }: ProgressModalProps) => {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center space-y-6 py-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10 animate-pulse">
              <FileText className="w-12 h-12 text-primary" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Generating PDFs
            </h3>
            <p className="text-muted-foreground text-sm">{stage}</p>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {current} / {total} documents
            </p>
          </div>

          {progress === 100 && (
            <div className="flex items-center justify-center gap-2 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Generation Complete</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
