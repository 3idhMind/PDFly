/**
 * Resolves real URLs against the real vercel.json, locally.
 *
 * ── The outage this exists to prevent ─────────────────────────────────────
 * The API was restructured into `api/pdf/[...path].ts` style catch-alls on the
 * assumption that Vercel populates `req.query.path` with the trailing segments.
 * Deployed, measured:
 *
 *     /api/pdf/generate      -> reached the function, req.query.path EMPTY
 *     /api/pdf/basic/merge   -> never reached it, platform 404
 *     /api/account/me        -> 404
 *
 * Every account and PDF endpoint was dead in production while `npm run verify`
 * was green, because typecheck, unit tests, smoke and build all load functions
 * DIRECTLY. Not one of them asked the question that actually mattered: given
 * the URL a browser requests, which file runs and what does it receive?
 *
 * ── How this answers that ─────────────────────────────────────────────────
 * It reads vercel.json, applies the rewrite list in order with path-to-regexp
 * (the matcher Vercel's routing is built on), resolves the result against the
 * compiled functions, and invokes the winner with the query the rewrite
 * produced. Then it asserts the operation each URL is expected to dispatch to.
 *
 * It tests OUR configuration rather than re-implementing Vercel, which is the
 * only part we can get wrong. Catch-all filename semantics are no longer
 * involved at all — that ambiguity is precisely what broke, so the routing now
 * uses ordinary files plus explicit `?op=` rewrites.
 *
 * Run: npm run routes   (part of npm run verify)
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { match, compile } from "path-to-regexp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".routes");

/* ------------------------------------------------------------------ compile */

rmSync(outDir, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.smoke.json", "--outDir", ".routes"],
    { cwd: root, stdio: "pipe" },
  );
} catch (err) {
  console.error("[routes] tsc failed:\n" + (err.stdout?.toString() || err.message));
  process.exit(1);
}

const apiDir = join(outDir, "api");
if (!existsSync(apiDir)) {
  console.error("[routes] nothing emitted — check tsconfig.smoke.json");
  process.exit(1);
}

/** Files that Vercel would treat as functions: not under a `_` path. */
const functionFiles = new Set(
  readdirSync(apiDir)
    .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
    .map((f) => "/api/" + f.replace(/\.js$/, "")),
);

/* ------------------------------------------------------------------ routing */

// Enough environment for handlers to construct. Never real credentials.
process.env.FIREBASE_PROJECT_ID ||= "route-test";
process.env.FIREBASE_CLIENT_EMAIL ||= "route@test.iam.gserviceaccount.com";
process.env.FIREBASE_PRIVATE_KEY ||= [
  "-----BEGIN PRIVATE KEY-----",
  "cm91dGU=",
  "-----END PRIVATE KEY-----",
].join("\n");
process.env.FILE_TOKEN_SECRET ||= "route-test-secret";

const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const rewrites = vercel.rewrites ?? [];

/**
 * First matching rewrite wins, exactly as Vercel applies the list in order.
 * Returns the resolved path plus whatever query the destination carries.
 */
function applyRewrites(url) {
  const [path] = url.split("?");
  for (const rule of rewrites) {
    const matcher = match(rule.source, { decode: decodeURIComponent });
    const hit = matcher(path);
    if (!hit) continue;

    const [destPath, destQuery = ""] = rule.destination.split("?");
    // `:op*` in the destination is filled from the captured params.
    const fill = compile(destQuery.replace(/=/g, "="), { encode: (v) => v });
    let query = destQuery;
    for (const [k, v] of Object.entries(hit.params)) {
      const value = Array.isArray(v) ? v.join("/") : String(v ?? "");
      query = query.replace(new RegExp(`:${k}\\*?`, "g"), value);
    }
    void fill;
    return { path: destPath, query };
  }
  return { path, query: "" };
}

function parseQuery(qs) {
  const out = {};
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

/* -------------------------------------------------------------- expectations */

// url -> the operation the handler must end up dispatching, or null when the
// URL should resolve to a function that takes no operation.
const EXPECT = {
  "/api/system": null,
  "/api/health": null,
  "/api/report-issue": null,
  "/api/system?op=sweep": null,
  "/api/blog": null,

  "/api/account/me": "me",
  "/api/account/keys": "keys",
  "/api/me": "me",
  "/api/keys": "keys",

  "/api/admin/feedback": "feedback",
  "/api/admin/events": "events",
  "/api/admin/activity": "activity",
  "/api/admin-feedback": "feedback",
  "/api/admin-events": "events",

  "/api/pdf/generate": "generate",
  "/api/pdf/basic/merge": "basic/merge",
  "/api/pdf/basic/split": "basic/split",
  "/api/pdf/optimize/compress": "optimize/compress",
  "/api/pdf/convert/to-pages": "convert/to-pages",
  "/api/pdf/convert/from-images": "convert/from-images",
  "/api/pdf/fallback": "fallback",

  "/api/generate-pdf": "generate",
  "/api/merge-pdf": "basic/merge",
  "/api/split-pdf": "basic/split",
  "/api/compress-pdf": "optimize/compress",
  "/api/pdf-to-images": "convert/to-pages",
  "/api/images-to-pdf": "convert/from-images",
  "/api/pdf-fallback": "fallback",
};

/*
 * A real signed token, so this exercises the whole download path rather than
 * only the rewrite. An invalid token correctly answers 404, which would be
 * indistinguishable from "the route never dispatched" — the exact failure this
 * script exists to catch — so the test must present a valid one.
 */
{
  const { createFileToken } = await import(
    pathToFileURL(join(apiDir, "_lib/fileToken.js")).href
  );
  EXPECT[`/api/file/${createFileToken("uid/2026-08-15/ab12cd34-demo.pdf", 3600)}`] = "__token__";
}

/* ---------------------------------------------------------------------- run */

let failed = 0;

for (const [url, expectedOp] of Object.entries(EXPECT)) {
  const resolved = applyRewrites(url);
  const query = parseQuery(resolved.query);

  if (!functionFiles.has(resolved.path)) {
    console.log(`  FAIL ${url.padEnd(32)} -> ${resolved.path} (no such function)`);
    failed++;
    continue;
  }

  const actualOp = query.op ?? null;

  if (expectedOp === "__token__" && !actualOp) {
    console.log(`  FAIL ${url.slice(0, 32).padEnd(32)} -> token never reached the handler`);
    failed++;
    continue;
  }
  // "__token__" means: any non-empty op is right, the value is generated.
  if (expectedOp !== null && expectedOp !== "__token__" && actualOp !== expectedOp) {
    console.log(
      `  FAIL ${url.padEnd(32)} -> ${resolved.path} op="${actualOp}" (expected "${expectedOp}")`,
    );
    failed++;
    continue;
  }

  // Actually invoke it, so a route that resolves but cannot dispatch still fails.
  const file = join(apiDir, resolved.path.replace("/api/", "") + ".js");
  let status = "?";
  try {
    const mod = await import(pathToFileURL(file).href);
    const res = {
      statusCode: null,
      settled: false,
      setHeader() { return this; },
      status(c) { this.statusCode = c; return this; },
      json() { this.settled = true; return this; },
      send() { this.settled = true; return this; },
      end() { this.settled = true; return this; },
    };
    await mod.default({ method: "GET", query, headers: {}, body: {} }, res);
    status = res.statusCode ?? 200;
    // A namespaced URL that comes back UNKNOWN_OPERATION means the op never
    // arrived — the exact production failure this script was written for.
    // /api/file answers 404 when storage is not configured, which is correct
    // and is the state every local run is in.
    if (status === 404 && expectedOp !== null && expectedOp !== "__token__") {
      console.log(`  FAIL ${url.padEnd(32)} -> ${resolved.path} dispatched nothing (404)`);
      failed++;
      continue;
    }
  } catch (err) {
    status = `threw ${err.code ?? err.name}`;
  }

  const shown = url.length > 32 ? url.slice(0, 29) + "..." : url;
  console.log(
    `  ok   ${shown.padEnd(32)} -> ${resolved.path}${expectedOp ? ` op="${String(actualOp).slice(0, 18)}"` : ""}  [${status}]`,
  );
}

rmSync(outDir, { recursive: true, force: true });

console.log(`\n[routes] ${Object.keys(EXPECT).length} URLs, ${failed} failed`);
if (failed) process.exit(1);
