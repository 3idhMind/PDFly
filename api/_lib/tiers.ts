/**
 * Per-tier ceilings, in one table.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * The size limit a caller gets was previously three different constants in
 * three handlers plus a fourth in the browser, and the pricing page quoted a
 * fifth. This is the single source of truth; everything else imports it.
 *
 * ── Why the free ceiling is 10 MB and not "whatever fits" ─────────────────
 * Vercel refuses request bodies over ~4.5 MB before our code runs, so anything
 * larger has to arrive in chunks (see handlers/upload.ts). 10 MB is the point
 * where chunking is still three or four round trips rather than hundreds, and
 * where a merge comfortably fits the 2 GB function memory. Above that the
 * honest answer is a conversation, not a silent 413.
 *
 * ── Growth and Enterprise are provisioned by hand ─────────────────────────
 * There is no self-serve upgrade path. An account gets `tier` set on its
 * product document after a human agrees terms, which is exactly what the
 * pricing page says happens. Anything past Growth also needs compute we do not
 * run on Vercel, so Enterprise is a setup conversation, not a flag flip.
 */

export type TierId = "free" | "growth" | "enterprise";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface TierLimits {
  id: TierId;
  label: string;
  /** Total input bytes accepted for one job, across every file in it. */
  maxJobBytes: number;
  monthlyQuota: number;
  ratePerMin: number;
  /** How long generated output stays downloadable. */
  retentionSeconds: number;
}

export const TIERS: Record<TierId, TierLimits> = {
  free: {
    id: "free",
    label: "Free",
    maxJobBytes: 10 * MB,
    monthlyQuota: 100,
    ratePerMin: 60,
    retentionSeconds: 3600,
  },
  growth: {
    id: "growth",
    label: "Growth",
    maxJobBytes: 1 * GB,
    monthlyQuota: 10_000,
    ratePerMin: 600,
    retentionSeconds: 24 * 3600,
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    maxJobBytes: 10 * GB,
    monthlyQuota: 1_000_000,
    ratePerMin: 3_000,
    retentionSeconds: 7 * 24 * 3600,
  },
};

export const FREE_TIER = TIERS.free;

/**
 * What a visitor with no account gets on the browser fallback path.
 *
 * Same size ceiling as Free, because the whole point of the fallback is that
 * the visitor's own device could not do the job — telling them to sign up at
 * that exact moment is the worst possible time to ask. The protection is a
 * tighter rate limit keyed on IP, not a smaller file.
 */
export const ANONYMOUS_TIER: TierLimits = {
  id: "free",
  label: "Anonymous",
  maxJobBytes: 10 * MB,
  monthlyQuota: 0, // not metered per account; the IP limiter is the control
  ratePerMin: 6,
  retentionSeconds: 3600,
};

/** Jobs an unsigned visitor may run from one IP in a day. */
export const ANONYMOUS_DAILY_LIMIT = 30;

function isTierId(value: unknown): value is TierId {
  return value === "free" || value === "growth" || value === "enterprise";
}

/**
 * The caller's tier.
 *
 * ── Why callers pass the job size in ──────────────────────────────────────
 * Almost every request is inside the free ceiling, and for those the answer
 * cannot change: no paid tier is ever *more* restrictive, so a job that fits
 * Free fits everything. Skipping the read on that path keeps a Firestore
 * lookup off the hot path entirely and only bills the rare oversized request
 * for finding out whether it is allowed.
 */
export async function tierFor(uid: string, jobBytes = 0): Promise<TierLimits> {
  if (jobBytes <= FREE_TIER.maxJobBytes) return FREE_TIER;

  try {
    // Imported here rather than at module scope so this file stays free of
    // Firebase at load time, which is what lets tiers.test.ts run it directly.
    const { productRef } = await import("./requireUser.js");
    const snap = await productRef(uid).get();
    const tier = snap.exists ? snap.data()?.tier : undefined;
    return isTierId(tier) ? TIERS[tier] : FREE_TIER;
  } catch {
    // A failed lookup must not silently promote anyone.
    return FREE_TIER;
  }
}

/** Human-readable size for an error message: "10 MB", "1 GB". */
export function formatLimit(bytes: number): string {
  return bytes >= GB ? `${Math.round(bytes / GB)} GB` : `${Math.round(bytes / MB)} MB`;
}
