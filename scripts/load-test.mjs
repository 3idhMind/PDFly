/**
 * Load / abuse test for PDFly's rate limiter and monthly quota.
 *
 * Roadmap item "Load and abuse testing". Runs against a live deployment.
 *
 *   node --env-file=.env scripts/load-test.mjs
 *
 * Env:
 *   PDFLY_BASE_URL   default https://pdfly.3idhmind.in
 *   PDFLY_API_KEY    required — an API key for the account under test
 *
 * ── Why the burst uses an INVALID body ────────────────────────────────────
 * Every PDF handler runs, in order: requireUser -> rateLimit -> checkQuota ->
 * body validation. So a request with an unusable body still consumes a
 * rate-limit token but generates zero documents and writes zero usage. That is
 * what makes it safe to fire 100+ requests at production without burning the
 * monthly allowance — and it is also, by itself, a finding: the cheap-to-send
 * request is the one that exercises the limiter.
 *
 * Only phase C spends real quota, and it spends at most 4 documents.
 */

import { Agent } from "node:https";

const BASE = (process.env.PDFLY_BASE_URL ?? "https://pdfly.3idhmind.in").replace(/\/+$/, "");
const KEY = process.env.PDFLY_API_KEY;
if (!KEY) {
  console.error("PDFLY_API_KEY is required");
  process.exit(1);
}

/** One socket, kept alive, so a sequential burst has the best possible chance
 *  of landing on a single serverless instance — which is the only condition
 *  under which an in-process limiter can be observed at all. */
const agent = new Agent({ keepAlive: true, maxSockets: 64 });

const auth = (k = KEY) => ({ authorization: `Bearer ${k}`, "content-type": "application/json" });

async function call(path, { method = "GET", body, headers = auth(), label } = {}) {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // @ts-ignore node fetch accepts an agent via dispatcher only in undici;
      // keepAlive is the default in Node 22's fetch, so this is belt & braces.
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return {
      label, status: res.status, ms: Date.now() - t, json,
      raw: json ? null : text.slice(0, 400),
      headers: Object.fromEntries(res.headers),
    };
  } catch (err) {
    return { label, status: 0, ms: Date.now() - t, error: err.message };
  }
}

/** Invalid body: passes auth + rate limit + quota check, dies at validation. */
const CHEAP = { path: "/api/pdf/generate", method: "POST", body: { documents: [] } };
const fireCheap = () => call(CHEAP.path, { method: CHEAP.method, body: CHEAP.body });

const tally = (rs) => {
  const t = {};
  for (const r of rs) {
    const code = r.json?.error ?? (r.error ? `NET:${r.error}` : "-");
    const k = `${r.status} ${code}`;
    t[k] = (t[k] ?? 0) + 1;
  }
  return t;
};

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const line = (s) => console.log(s);
const head = (s) => console.log(`\n${"=".repeat(72)}\n${s}\n${"=".repeat(72)}`);

/* ------------------------------------------------------------------ phase A */

async function phaseIdentity() {
  head("A  identity + error shapes");
  const me = await call("/api/account/me");
  line(`GET /api/account/me            -> ${me.status} ${JSON.stringify(me.json)} (${me.ms}ms)`);

  const probes = [
    ["no header             ", "/api/account/me", { "content-type": "application/json" }],
    ["short token           ", "/api/account/me", auth("abc")],
    ["bad api key           ", "/api/account/me", auth("pdfly_live_" + "A".repeat(43))],
    ["jwt-shaped junk       ", "/api/account/me", auth("a".repeat(60))],
    ["api key on key mgmt   ", "/api/account/keys", auth()],
  ];
  for (const [name, path, headers] of probes) {
    const r = await call(path, { headers });
    line(`${name} ${path.padEnd(20)} -> ${r.status} ${JSON.stringify(r.json ?? r.raw)}`);
  }

  const notFound = await call("/api/pdf/does/not/exist", { method: "POST", body: {} });
  line(`unknown op                    -> ${notFound.status} ${JSON.stringify(notFound.json)}`);
  return me.json?.uid ?? null;
}

/* ------------------------------------------------------------------ phase B */

async function phaseSequential(n = 75) {
  head(`B  sequential burst, ${n} requests, one keep-alive socket (limit should be 60/min)`);
  const t0 = Date.now();
  const results = [];
  let first429 = -1;
  for (let i = 0; i < n; i++) {
    const r = await fireCheap();
    results.push(r);
    if (r.status === 429 && first429 < 0) {
      first429 = i + 1;
      line(`  first 429 at request #${first429}, t+${((Date.now() - t0) / 1000).toFixed(1)}s`);
      line(`  body:    ${JSON.stringify(r.json)}`);
      const hinting = Object.entries(r.headers).filter(([k]) =>
        /retry|ratelimit|x-rate/i.test(k));
      line(`  headers: ${hinting.length ? JSON.stringify(Object.fromEntries(hinting)) : "NO retry-after / ratelimit headers"}`);
    }
    if (first429 > 0 && i >= first429 + 4) break;
    if (Date.now() - t0 > 55_000) { line("  aborting: 55s elapsed, fixed window would have rolled"); break; }
  }
  const elapsed = (Date.now() - t0) / 1000;
  const lat = results.filter((r) => r.status).map((r) => r.ms);
  line(`  sent ${results.length} in ${elapsed.toFixed(1)}s  p50=${pct(lat, 50)}ms p95=${pct(lat, 95)}ms`);
  line(`  ${JSON.stringify(tally(results), null, 0)}`);
  line(first429 > 0
    ? `  VERDICT: limiter triggered at request ${first429}`
    : `  VERDICT: NO 429 in ${results.length} sequential requests within ${elapsed.toFixed(1)}s`);
  return { first429, count: results.length, elapsed, results };
}

/* ------------------------------------------------------------------ phase C */

async function phaseParallel(n = 60, conc = 60) {
  head(`C  parallel burst, ${n} requests, concurrency ${conc} (tests atomicity / instance fan-out)`);
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: n }, fireCheap));
  const elapsed = (Date.now() - t0) / 1000;
  const limited = results.filter((r) => r.status === 429).length;
  line(`  ${n} requests in ${elapsed.toFixed(1)}s -> ${limited} were 429, ${n - limited} were not`);
  line(`  ${JSON.stringify(tally(results))}`);
  return { limited, n, elapsed };
}

/* ------------------------------------------------------------------ phase D */

async function phaseQuota(uid) {
  head("D  quota accounting (spends at most 4 documents)");

  const before = await readUsage(uid);
  line(`  usage before: ${JSON.stringify(before)}`);

  const doc = (i) => ({ title: `loadtest-${i}`, content: `probe ${i}` });
  const three = await call("/api/pdf/generate", {
    method: "POST",
    body: { documents: [doc(1), doc(2), doc(3)] },
  });
  line(`  3-document request -> ${three.status}  documents_generated=${three.json?.usage?.documents_generated}  returned=${three.json?.documents?.length}`);

  const one = await call("/api/pdf/generate", { method: "POST", body: { documents: [doc(4)] } });
  line(`  1-document request -> ${one.status}  documents_generated=${one.json?.usage?.documents_generated}`);

  const after = await readUsage(uid);
  line(`  usage after:  ${JSON.stringify(after)}`);
  if (before && after) {
    line(`  DELTA pdfsGenerated=${after.pdfsGenerated - before.pdfsGenerated} (expected 4)  apiCalls=${after.apiCalls - before.apiCalls} (expected 2)`);
  }
  return { three, one, before, after };
}

/** Direct Firestore read, so quota claims are not taken on the API's word.
 *  Optional: needs FIREBASE_* in the environment. */
async function readUsage(uid) {
  if (!uid || !process.env.FIREBASE_PROJECT_ID) return null;
  try {
    const { cert, getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app = getApps().length ? getApps()[0] : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n"),
      }),
    });
    const db = () => getFirestore(app);
    const PRODUCT_ID = "pdfly";
    const month = new Date().toISOString().slice(0, 7);
    const snap = await db()
      .collection("users").doc(uid)
      .collection("products").doc(PRODUCT_ID)
      .collection("usage").doc(month).get();
    if (!snap.exists) return { pdfsGenerated: 0, apiCalls: 0 };
    const d = snap.data();
    return { pdfsGenerated: d.pdfsGenerated ?? 0, apiCalls: d.apiCalls ?? 0, bytesProcessed: d.bytesProcessed ?? 0 };
  } catch (err) {
    return { unavailable: err.message.slice(0, 120) };
  }
}

/* ---------------------------------------------------------------------- run */

const only = process.argv[2];
if (only === "parallel") {
  // Fresh window assumed: run this at least 60s after any other burst.
  await phaseParallel(Number(process.argv[3] ?? 90), 90);
  process.exit(0);
}
const uid = await phaseIdentity();
if (!only || only === "quota") await phaseQuota(uid);
if (!only || only === "burst") {
  const seq = await phaseSequential(75);
  // Only run the parallel burst if the sequential one did not already leave the
  // subject limited — otherwise every result is a foregone 429.
  if (seq.first429 < 0) await phaseParallel(60);
  else line("\n(skipping parallel burst: subject is already inside a tripped window)");
}
agent.destroy();
process.exit(0);
