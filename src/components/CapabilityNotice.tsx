import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, CloudCog, AlertTriangle, Cpu } from "lucide-react";
import { formatBytes, type ProcessingPlan } from "@/lib/deviceCapability";

interface Props {
  plan: ProcessingPlan | null;
  cloudConsent: boolean;
  onCloudConsentChange: (v: boolean) => void;
  /** Set false for tools with no server-side equivalent (e.g. Text to PDF). */
  cloudAvailable?: boolean;
}

export const CapabilityNotice = ({
  plan,
  cloudConsent,
  onCloudConsentChange,
  cloudAvailable = true,
}: Props) => {
  if (!plan) return null;

  const consentRow = cloudAvailable && (
    <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
      <Checkbox
        checked={cloudConsent}
        onCheckedChange={(c) => onCloudConsentChange(c === true)}
        className="mt-0.5"
      />
      <span className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          {plan.level === "too-large"
            ? "Process this file on our secure cloud instead"
            : "If it fails here, finish it on our secure cloud"}
        </span>
        <br />
        Processed in memory and sent straight back to you. Never stored, never logged — deleted
        instantly (well under 15 minutes).
      </span>
    </label>
  );

  if (plan.level === "safe") {
    return (
      <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs">
          <p className="font-medium text-foreground">
            Runs 100% locally on your device — nothing is uploaded.
          </p>
          <p className="text-muted-foreground mt-0.5">
            {formatBytes(plan.totalBytes)} selected · uses about {plan.usagePct}% of what this
            device can handle.
          </p>
        </div>
      </div>
    );
  }

  if (plan.level === "risky") {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-foreground">
              Heavy for this device — about {plan.failureRisk}% chance it fails or freezes.
            </p>
            <p className="text-muted-foreground mt-0.5">
              {formatBytes(plan.totalBytes)} selected · your device comfortably handles up to{" "}
              {formatBytes(plan.maxSafeBytes)}. We'll still try locally first.
            </p>
          </div>
        </div>
        {consentRow}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5">
      <div className="flex items-start gap-3">
        <Cpu className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs">
          <p className="font-medium text-foreground">
            Too large to process on this device.
          </p>
          <p className="text-muted-foreground mt-0.5">
            {formatBytes(plan.totalBytes)} selected, but this device can safely handle about{" "}
            {formatBytes(plan.maxSafeBytes)}. Use a smaller file, or let our cloud do it.
          </p>
        </div>
      </div>
      {consentRow}
      {cloudAvailable && !cloudConsent && (
        <p className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
          <CloudCog className="w-3 h-3" /> Tick the box above to continue.
        </p>
      )}
    </div>
  );
};
