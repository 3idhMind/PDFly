// Free-generation gate: anonymous users get 1 free PDF generation.
// Subsequent attempts require login. Tracking uses localStorage + a lightweight
// device fingerprint (FingerprintJS open-source) so it survives clearing one
// of the two but is bypassable by determined users — that's an acceptable
// trade-off to keep the privacy promise (no server tracking).

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "pdfly:free_gen_count";
const FP_KEY = "pdfly:fp_gen_count"; // mirrored under fingerprint hash
const FREE_LIMIT = 1;

let fpPromise: Promise<string> | null = null;

async function getFingerprint(): Promise<string> {
  if (!fpPromise) {
    fpPromise = (async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        return result.visitorId;
      } catch {
        return "anon";
      }
    })();
  }
  return fpPromise;
}

function readCount(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* private mode etc. */
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export interface GateResult {
  allowed: boolean;
  remaining: number;
  reason?: "logged-in" | "first-free" | "limit-reached";
}

/** Check (without consuming) whether the next generation is allowed. */
export async function checkFreeGate(): Promise<GateResult> {
  if (await isLoggedIn()) return { allowed: true, remaining: Infinity, reason: "logged-in" };

  const fp = await getFingerprint();
  const fpKey = `${FP_KEY}:${fp}`;
  const used = Math.max(readCount(LS_KEY), readCount(fpKey));
  const remaining = Math.max(0, FREE_LIMIT - used);

  if (used >= FREE_LIMIT) return { allowed: false, remaining: 0, reason: "limit-reached" };
  return { allowed: true, remaining, reason: "first-free" };
}

/** Mark one generation as consumed (call after a successful generation). */
export async function consumeFreeGeneration(): Promise<void> {
  if (await isLoggedIn()) return;
  const fp = await getFingerprint();
  const fpKey = `${FP_KEY}:${fp}`;
  const used = Math.max(readCount(LS_KEY), readCount(fpKey)) + 1;
  writeCount(LS_KEY, used);
  writeCount(fpKey, used);
}
