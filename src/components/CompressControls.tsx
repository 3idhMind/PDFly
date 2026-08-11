import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FileText, ScanLine, Layers, Gauge } from "lucide-react";
import { formatBytes as fmt } from "@/lib/utils";
import type { PdfAnalysis } from "@/lib/pdfTools/analyzePdf";
import type { QualityFloor } from "@/lib/pdfTools/compress";

/**
 * Ordered by what people actually search for, not by round MB numbers.
 * Google India's autocomplete for "compress pdf to " orders as 200kb, 100kb,
 * 500kb, 1mb, 300kb, 50kb — a portal-upload audience, not a "make it smaller
 * for email" one. The old preset list (10/5/2/1 MB) matched neither. KB
 * presets lead; MB presets stay for genuinely large scans/exports.
 */
const PRESETS = [
  { label: "50 KB", bytes: 50 * 1024 },
  { label: "100 KB", bytes: 100 * 1024 },
  { label: "200 KB", bytes: 200 * 1024 },
  { label: "300 KB", bytes: 300 * 1024 },
  { label: "500 KB", bytes: 500 * 1024 },
  { label: "1 MB", bytes: 1 * 1024 * 1024 },
  { label: "2 MB", bytes: 2 * 1024 * 1024 },
  { label: "5 MB", bytes: 5 * 1024 * 1024 },
  { label: "10 MB", bytes: 10 * 1024 * 1024 },
];

const QUALITY: { key: QualityFloor; label: string; hint: string }[] = [
  { key: "maximum", label: "Maximum", hint: "Barely touch quality" },
  { key: "balanced", label: "Balanced", hint: "Crisp on screen and in print" },
  { key: "small", label: "Small", hint: "Clearly readable, softer images" },
  { key: "smallest", label: "Smallest", hint: "Whatever it takes to hit the target" },
];

interface Props {
  analysis: PdfAnalysis;
  targetBytes: number;
  onTargetChange: (b: number) => void;
  quality: QualityFloor;
  onQualityChange: (q: QualityFloor) => void;
  disabled?: boolean;
}

export const CompressControls = ({
  analysis,
  targetBytes,
  onTargetChange,
  quality,
  onQualityChange,
  disabled,
}: Props) => {
  const Icon = analysis.kind === "scanned" ? ScanLine : analysis.kind === "mixed" ? Layers : FileText;
  // Bug this replaces: minTarget used to floor at a hardcoded 50KB regardless
  // of the file. For anything smaller than ~70KB (a short text PDF, a test
  // file) that made minTarget > the file's own size, collapsing maxTarget to
  // within 1 byte of it — a slider with no usable range, presets that all
  // failed their own "smaller than the file" filter, and a "Max compression"
  // button that could only ever land on 50KB. Tie the floor to what this
  // specific file can actually reach instead of a number picked for no file.
  const minTarget = Math.max(1024, Math.round(analysis.floorBytes * 0.7));
  const maxTarget = Math.max(minTarget + 1024, analysis.bytes);
  const clamped = Math.min(Math.max(targetBytes, minTarget), maxTarget);
  const pctOfOriginal = Math.round((clamped / analysis.bytes) * 100);

  return (
    <div className="mt-5 space-y-5">
      {/* Analysis */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <div className="text-xs leading-relaxed">
          <p className="font-medium text-foreground">
            {fmt(analysis.bytes)} · {analysis.pages} page{analysis.pages === 1 ? "" : "s"}
          </p>
          <p className="text-muted-foreground mt-0.5">{analysis.verdict}</p>
          <p className="text-muted-foreground mt-0.5">
            Realistic best case for this file: about{" "}
            <span className="text-foreground font-medium">{fmt(analysis.floorBytes)}</span>.
          </p>
        </div>
      </div>

      {/* Target size */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
            Target size
          </label>
          <span className="text-sm font-semibold text-primary">
            {fmt(clamped)} <span className="text-muted-foreground font-normal">({pctOfOriginal}% of original)</span>
          </span>
        </div>
        <Slider
          value={[clamped]}
          min={minTarget}
          max={maxTarget}
          step={Math.max(1024, Math.round((maxTarget - minTarget) / 200))}
          disabled={disabled}
          onValueChange={(v) => onTargetChange(v[0])}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {PRESETS.filter((p) => p.bytes < analysis.bytes).map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={Math.abs(clamped - p.bytes) < 1024 ? "default" : "outline"}
              disabled={disabled}
              className="rounded-full h-11 sm:h-8 text-xs"
              onClick={() => onTargetChange(Math.max(minTarget, p.bytes))}
            >
              Under {p.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={clamped <= minTarget ? "default" : "outline"}
            disabled={disabled}
            className="rounded-full h-11 sm:h-8 text-xs"
            onClick={() => onTargetChange(minTarget)}
          >
            Max compression
          </Button>
        </div>
      </div>

      {/* Quality floor */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs uppercase tracking-wider font-medium text-muted-foreground inline-flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" /> Lowest quality you'll accept
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUALITY.map((q) => (
            <button
              key={q.key}
              type="button"
              disabled={disabled}
              onClick={() => onQualityChange(q.key)}
              className={`rounded-xl border p-2.5 text-left transition-colors ${
                quality === q.key
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <span className="block text-xs font-medium text-foreground">{q.label}</span>
              <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                {q.hint}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          We always deliver the <span className="text-foreground font-medium">best quality that still fits</span> your
          target — this only sets how far we're allowed to go if it doesn't.
        </p>
      </div>
    </div>
  );
};
