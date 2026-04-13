import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodeEntry {
  language: string;
  label: string;
  code: string;
}

interface CodeSwitcherProps {
  title?: string;
  entries: CodeEntry[];
}

export const CodeSwitcher = ({ title, entries }: CodeSwitcherProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(entries[activeIndex].code);
    setCopied(true);
    toast({ title: "Copied!", description: `${entries[activeIndex].label} code copied to clipboard` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border">
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      )}
      <div className="flex items-center justify-between bg-muted/50 border-b border-border px-2">
        <div className="flex gap-0 overflow-x-auto">
          {entries.map((entry, i) => (
            <button
              key={entry.language}
              onClick={() => setActiveIndex(i)}
              className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                i === activeIndex
                  ? "border-primary text-primary bg-background/50"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 shrink-0"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre className="text-xs bg-muted p-4 overflow-x-auto text-foreground m-0 rounded-none">
        <code>{entries[activeIndex].code}</code>
      </pre>
    </div>
  );
};
