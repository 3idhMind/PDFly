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
 *
 * ── `cost` exists because the old check overshot on every batch ───────────
 * This used to test `used < limit` and nothing else. A caller sitting at 99 of
 * 100 who sent a 5-document request passed the gate and finished at 104: the
 * check asked "may you generate a document" when the question was "may you
 * generate five". Measured, not theorised. `cost` defaults to 1 so single-item
 * callers are unchanged.
 *
 * ── What this still does not solve ────────────────────────────────────────
 * This is a read, and the increment happens after the work in `recordUsage`.
 * Two requests that arrive together both read the same `used` and both pass.
 * The counter itself never loses a count — `recordUsage` uses atomic
 * increments — so the overshoot is bounded by concurrency, not unbounded drift.
 *
 * Closing that window needs a transaction spanning check and increment, which
 * means reserving quota before rendering and refunding it when a render fails.
 * That is a real design change and it is tracked, not pretended away here. On a
 * free tier where the penalty for overshoot is a few extra PDFs, the honest
 * trade is to bound it and say so.
 */
export async function checkQuota(uid: string, cost = 1): Promise<QuotaVerdict> {
  const snap = await usageRef(uid).get();
  const used = snap.exists ? (snap.data()?.pdfsGenerated ?? 0) : 0;
  const limit = FREE_TIER_MONTHLY_QUOTA;
  return {
    allowed: used + cost <= limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
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
export function rateLimit(
  subject: string,
  limitPerMin: number,
  windowMs = 60_000,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(subject);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(subject, { count: 1, resetAt: now + windowMs });
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

/**
 * Best-effort client IP, used to bound visitors with no account at all.
 *
 * `x-forwarded-for` is client-controllable in general, but on Vercel the proxy
 * appends the real peer address and it is the *last* entry that the platform
 * guarantees. `x-real-ip` is set by the same proxy and is not forwarded from
 * the client, so it is preferred where present.
 *
 * ponytail: an IP is a weak identity — mobile carriers NAT thousands of users
 * behind one, and a determined abuser rotates addresses. This is a speed bump
 * for casual scripted abuse, not an access control. The real control on the
 * anonymous path is that it costs us CPU and nothing else: no account data is
 * reachable without a credential.
 */
export function clientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();

  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (typeof raw === "string" && raw.trim()) {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
