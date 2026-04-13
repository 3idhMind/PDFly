import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, X, GripVertical } from "lucide-react";

interface InputSectionProps {
  id: string;
  title: string;
  value: string;
  onTitleChange: (title: string) => void;
  onContentChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  language: string;
  index: number;
}

export const InputSection = ({
  title,
  value,
  onTitleChange,
  onContentChange,
  onRemove,
  canRemove,
  language,
  index,
}: InputSectionProps) => {
  const fontClass = language === "hi" || language === "bn" ? "font-devanagari" : "";

  return (
    <Card className="p-5 bg-card shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
        <FileText className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">#{index + 1}</span>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Document title..."
          className="h-8 text-sm font-semibold border-none shadow-none focus-visible:ring-1 bg-transparent"
        />
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Enter your content here... Supports HTML, plain text, any language, and emojis 🎬🎥📋"
        className={`min-h-[250px] resize-none text-sm ${fontClass} font-sans`}
      />
      <div className="mt-2 text-xs text-muted-foreground">
        {value.length} characters
      </div>
    </Card>
  );
};
