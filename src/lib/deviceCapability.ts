/**
 * Device capability probe.
 *
 * Silently estimates how much PDF work this device can realistically do
 * in-browser, caches the result (obfuscated) in localStorage, and re-probes
 * weekly. Nothing is sent anywhere — this is a purely local measurement.
 */

const STORE_KEY = "_pdfly_dc";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const MB = 1024 * 1024;

export interface DeviceProfile {
  /** Largest total input size we believe this device can process locally. */
  maxSafeBytes: number;
  /** 0-100 rough performance score. */
  score: number;
  /** Estimated usable JS heap in bytes. */
  heapBytes: number;
  tier: "low" | "mid" | "high";
  mobile: boolean;
  probedAt: number;
}

/* ---------------------------------------------------------------- storage */

function encode(value: unknown): string {
  const json = JSON.stringify(value);
  // Light obfuscation so casual inspection reveals nothing useful.
  const scrambled = Array.from(json)
    .map((c) => String.fromCharCode(c.charCodeAt(0) ^ 0x2f))
    .join("");
  return btoa(unescape(encodeURIComponent(scrambled)));
}

function decode(raw: string): DeviceProfile | null {
  try {
    const scrambled = decodeURIComponent(escape(atob(raw)));
    const json = Array.from(scrambled)
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ 0x2f))
      .join("");
    return JSON.parse(json) as DeviceProfile;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ probe */

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);
}

/** Timed arithmetic benchmark → rough CPU throughput score. */
function cpuBenchmark(): number {
  const start = performance.now();
  let acc = 0;
  for (let i = 0; i < 3_000_000; i++) acc += Math.sqrt(i % 1024);
  const ms = performance.now() - start || 1;
  void acc;
  // ~10ms on a fast desktop, ~120ms+ on a weak phone.
  return Math.max(0, Math.min(100, Math.round((60 / ms) * 100)));
}

/** Incremental allocation probe — stops as soon as allocation fails. */
function allocationProbe(limitMb: number): number {
  const chunks: ArrayBuffer[] = [];
  let allocated = 0;
  try {
    while (allocated < limitMb) {
      chunks.push(new ArrayBuffer(16 * MB));
      allocated += 16;
    }
  } catch {
    /* hit the ceiling */
  } finally {
    chunks.length = 0;
  }
  return allocated * MB;
}

function measureHeap(mobile: boolean): number {
  const perfMemory = (performance as unknown as { memory?: { jsHeapSizeLimit?: number } }).memory;
  if (perfMemory?.jsHeapSizeLimit) return perfMemory.jsHeapSizeLimit;

  const deviceMemoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (deviceMemoryGb) {
    // Browsers only expose a fraction of system RAM to a single tab.
    return deviceMemoryGb * 1024 * MB * (mobile ? 0.18 : 0.3);
  }

  // Last resort: measure directly (capped so we never actually exhaust RAM).
  const probed = allocationProbe(mobile ? 256 : 768);
  return probed || (mobile ? 384 * MB : 1024 * MB);
}

export function probeDevice(): DeviceProfile {
  const mobile = isMobile();
  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2;
  const heapBytes = measureHeap(mobile);
  const cpu = cpuBenchmark();

  const coreScore = Math.min(100, (cores / 8) * 100);
  const memScore = Math.min(100, (heapBytes / (2048 * MB)) * 100);
  const score = Math.round(cpu * 0.35 + coreScore * 0.2 + memScore * 0.45);

  // PDF work typically needs 3-5x the input size in working memory.
  const overhead = mobile ? 5 : 4;
  let maxSafeBytes = Math.floor((heapBytes * 0.6) / overhead);

  // Keep the estimate inside sane real-world bounds.
  const floor = mobile ? 12 * MB : 40 * MB;
  const ceiling = mobile ? 200 * MB : 1200 * MB;
  maxSafeBytes = Math.max(floor, Math.min(ceiling, maxSafeBytes));

  const tier: DeviceProfile["tier"] = score >= 65 ? "high" : score >= 35 ? "mid" : "low";

  return { maxSafeBytes, score, heapBytes, tier, mobile, probedAt: Date.now() };
}

/* ------------------------------------------------------------------ cache */

let inMemory: DeviceProfile | null = null;

export function getDeviceProfile(): DeviceProfile {
  if (inMemory) return inMemory;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      const cached = raw ? decode(raw) : null;
      if (cached && Date.now() - cached.probedAt < TTL_MS && cached.maxSafeBytes > 0) {
        inMemory = cached;
        return cached;
      }
    } catch {
      /* storage unavailable — fall through to a fresh probe */
    }
  }

  const fresh = probeDevice();
  inMemory = fresh;
  try {
    window.localStorage.setItem(STORE_KEY, encode(fresh));
  } catch {
    /* ignore */
  }
  return fresh;
}

/** Warm the cache without blocking first paint. */
export function warmDeviceProfile(): void {
  if (typeof window === "undefined" || inMemory) return;
  const run = () => {
    try {
      getDeviceProfile();
    } catch {
      /* never break the app over a probe */
    }
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) ric(run);
  else window.setTimeout(run, 1200);
}

/* ------------------------------------------------------------- assessment */

export type RiskLevel = "safe" | "risky" | "too-large";

export interface ProcessingPlan {
  level: RiskLevel;
  /** 0-100: chance the local run fails or hangs. */
  failureRisk: number;
  /** Percentage of the device budget this job uses. */
  usagePct: number;
  totalBytes: number;
  maxSafeBytes: number;
  profile: DeviceProfile;
}

export function assessJob(totalBytes: number): ProcessingPlan {
  const profile = getDeviceProfile();
  const usagePct = profile.maxSafeBytes > 0 ? (totalBytes / profile.maxSafeBytes) * 100 : 0;

  let level: RiskLevel = "safe";
  if (usagePct > 100) level = "too-large";
  else if (usagePct >= 70) level = "risky";

  // Below 70% risk is negligible; between 70-100% it ramps up to ~45%.
  const failureRisk =
    usagePct <= 70 ? Math.round(usagePct / 25) : Math.min(95, Math.round((usagePct - 70) * 1.5 + 5));

  return {
    level,
    failureRisk,
    usagePct: Math.round(usagePct),
    totalBytes,
    maxSafeBytes: profile.maxSafeBytes,
    profile,
  };
}

// Canonical implementation lives in lib/utils.ts. Re-exported here so existing
// `import { formatBytes } from "@/lib/deviceCapability"` call sites keep working.
export { formatBytes } from "./utils";
