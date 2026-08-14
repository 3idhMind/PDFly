import { FieldValue } from "firebase-admin/firestore";
import { db, PRODUCT_ID, FREE_TIER_MONTHLY_QUOTA } from "./firebase.js";
import type { Caller } from "./requireUser.js";

/** "2026-08" — also the document ID, so a new month resets by existing. */
export function currentMonthId(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function usageRef(uid: string, month = currentMonthId()) {
  return db()
    .collection("users").doc(uid)
    .collection("products").doc(PRODUCT_ID)
    .collection("usage").doc(month);
}

export interface QuotaVerdict {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Checks the caller's monthly allowance.
 *
 * One document read. A missing document means zero used — which is why there is
 * no monthly reset job: the month is the document ID, so August's counter
 * simply isn't July's.
 */
export async function checkQuota(uid: string): Promise<QuotaVerdict> {
  const snap = await usageRef(uid).get();
  const used = snap.exists ? (snap.data()?.pdfsGenerated ?? 0) : 0;
  const limit = FREE_TIER_MONTHLY_QUOTA;
  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Records a completed job. One write, atomic increments, no read-modify-write —
 * so concurrent requests can't lose counts to each other.
 */
export async function recordUsage(
  uid: string,
  opts: { pdfs?: number; apiCalls?: number; bytes?: number } = {},
): Promise<void> {
  await usageRef(uid).set(
    {
      pdfsGenerated: FieldValue.increment(opts.pdfs ?? 0),
      apiCalls: FieldValue.increment(opts.apiCalls ?? 1),
      bytesProcessed: FieldValue.increment(opts.bytes ?? 0),
      lastUsedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/* ---------------------------------------------------------------- rate limit */

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

/**
 * Per-minute fixed-window rate limiter, in process memory.
 *
 * ponytail: per-instance only — a caller spread across N warm instances gets up
 * to N× the limit. Deliberate. The Firestore alternative costs a read plus a
 * write on *every* API request purely for accounting, which would roughly
 * double the database bill for the whole product to close a gap that only
 * matters under real concurrent load. This stops runaway loops and accidental
 * hammering, which is what actually happens at our traffic.
 *
 * Upgrade path when it stops being enough: Upstash Redis (free tier) or Vercel
 * Firewall rate limiting — swap the body of this function, nothing else.
 *
 * The monthly quota above is the hard, authoritative limit and IS shared state.
 */
export function rateLimit(subject: string, limitPerMin: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(subject);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(subject, { count: 1, resetAt: now + 60_000 });
    // Cheap unbounded-growth guard: a warm instance can't accumulate forever.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    return { ok: true, retryAfter: 0 };
  }

  bucket.count++;
  if (bucket.count > limitPerMin) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Rate-limit key: per API key where there is one, else per user. */
export function subjectOf(caller: Caller): string {
  return caller.keyDocId ? `k:${caller.keyDocId}` : `u:${caller.uid}`;
}
