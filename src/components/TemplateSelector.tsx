import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pdfTemplates } from "@/types/pdf";
import { Shuffle, Check } from "lucide-react";
import { useState } from "react";

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateChange: (templateId: string) => void;
}

export const TemplateSelector = ({
  selectedTemplate,
  onTemplateChange,
}: TemplateSelectorProps) => {
  const [showAll, setShowAll] = useState(false);

  const handleRandom = () => {
    const randomTemplate = pdfTemplates[Math.floor(Math.random() * pdfTemplates.length)];
    onTemplateChange(randomTemplate.id);
  };

  const displayedTemplates = showAll ? pdfTemplates : pdfTemplates.slice(0, 5);

  return (
    <Card className="p-6 mb-8 bg-card shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">PDF Template</h3>
        <Button
          onClick={handleRandom}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Shuffle className="w-4 h-4" />
          Random
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {displayedTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onTemplateChange(template.id)}
            className={`relative p-4 rounded-lg border-2 transition-all hover:shadow-md ${
              selectedTemplate === template.id
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            {selectedTemplate === template.id && (
              <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                <Check className="w-3 h-3" />
              </div>
            )}
            <div className="text-3xl mb-2">{template.preview}</div>
            <div className="text-sm font-medium text-foreground mb-1">
              {template.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {template.description}
            </div>
            <div className="flex gap-1 mt-2 justify-center">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: template.colors.primary }}
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: template.colors.secondary }}
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: template.colors.accent }}
              />
            </div>
          </button>
        ))}
      </div>

      {!showAll && (
        <Button
          onClick={() => setShowAll(true)}
          variant="ghost"
          className="w-full"
        >
          Show All {pdfTemplates.length} Templates
        </Button>
      )}

      {showAll && (
        <Button
          onClick={() => setShowAll(false)}
          variant="ghost"
          className="w-full"
        >
          Show Less
        </Button>
      )}
    </Card>
  );
};
