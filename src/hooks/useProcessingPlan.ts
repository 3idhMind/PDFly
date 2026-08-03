import { useMemo, useState } from "react";
import { assessJob, type ProcessingPlan } from "@/lib/deviceCapability";

export interface ProcessingPlanState {
  plan: ProcessingPlan | null;
  /** Whether the user allowed a secure cloud fallback for this job. */
  cloudConsent: boolean;
  setCloudConsent: (v: boolean) => void;
  /** True when the job cannot run and the user has not opted into cloud. */
  blocked: boolean;
}

/**
 * Assesses whether the selected files can be processed on this device and
 * tracks the user's consent for the secure cloud fallback.
 */
export function useProcessingPlan(files: File[] | number): ProcessingPlanState {
  const totalBytes = useMemo(() => {
    if (typeof files === "number") return files;
    return files.reduce((sum, f) => sum + f.size, 0);
  }, [files]);

  const [cloudConsent, setCloudConsent] = useState(false);

  const plan = useMemo(() => (totalBytes > 0 ? assessJob(totalBytes) : null), [totalBytes]);

  return {
    plan,
    cloudConsent,
    setCloudConsent,
    blocked: plan?.level === "too-large" && !cloudConsent,
  };
}
