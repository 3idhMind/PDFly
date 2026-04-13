import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, FileType } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { pageSizes } from "@/types/pdf";

interface ControlPanelProps {
  language: string;
  setLanguage: (lang: string) => void;
  pageSize: string;
  setPageSize: (size: string) => void;
  onGenerate: () => void;
  disabled: boolean;
}

export const ControlPanel = ({
  language,
  setLanguage,
  pageSize,
  setPageSize,
  onGenerate,
  disabled,
}: ControlPanelProps) => {
  return (
    <Card className="p-6 mb-8 bg-card shadow-md">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <LanguageSelector value={language} onChange={setLanguage} />

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FileType className="w-4 h-4 text-primary" />
            <label className="text-sm font-medium text-foreground">Page Size</label>
          </div>
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {pageSizes.map((size) => (
                <SelectItem key={size.id} value={size.id}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={onGenerate}
          disabled={disabled}
          size="lg"
          className="md:w-auto w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
        >
          <FileDown className="w-5 h-5 mr-2" />
          Generate PDFs
        </Button>
      </div>
    </Card>
  );
};
