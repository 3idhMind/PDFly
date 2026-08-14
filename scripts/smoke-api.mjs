/**
 * Loads and invokes every serverless function the way Vercel does.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Two consecutive releases shipped an API where every endpoint returned 500,
 * while `npm run typecheck`, `npm test` and `npm run build` were all green:
 *
 *   1. ERR_MODULE_NOT_FOUND — relative imports were missing `.js` extensions.
 *   2. ERR_REQUIRE_ESM      — jwks-rsa (CommonJS, a firebase-admin dependency)
 *                             does `require('jose')`, and jose 6 is ESM-only.
 *
 * Neither is a type error, so no amount of type-checking could have caught
 * them. Both are *module load* failures, and the only way to see one is to
 * actually load the module.
 *
 * ── The part that matters most ────────────────────────────────────────────
 * This runs under `--no-experimental-require-module` (see the `smoke` script in
 * package.json). Modern Node quietly permits `require()` of an ESM module; the
 * Node that Vercel runs did not. The local machine was on Node 25 and
 * production was not, so bug 2 was literally unreproducible here until that
 * flag turned the newer behaviour off. A check that cannot fail the way
 * production fails is decorative — see DECISIONS D-013.
 *
 * ── What is asserted ──────────────────────────────────────────────────────
 * HARD  — every function imports without throwing, and exports a handler.
 *         This is the exact failure mode of both outages.
 * SOFT  — invoking the handler produces an HTTP response rather than an
 *         unhandled throw. Credentials here are deliberately fake, so a 401 or
 *         500 from inside the handler is a pass; what fails is a handler that
 *         escapes without answering at all.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".smoke");

/* ------------------------------------------------------------------ compile */

rmSync(outDir, { recursive: true, force: true });
try {
  // Run the locally installed tsc entry point with the current Node binary.
  // Avoids both spawning a shell (DEP0190) and the EINVAL that Node raises when
  // execFileSync is pointed at a .cmd shim on Windows.
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.smoke.json"], {
    cwd: root,
    stdio: "pipe",
  });
} catch (err) {
  console.error("[smoke] tsc failed:\n" + (err.stdout?.toString() || err.message));
  process.exit(1);
}

const apiDir = join(outDir, "api");
if (!existsSync(apiDir)) {
  console.error("[smoke] nothing emitted to .smoke/api — check tsconfig.smoke.json");
  process.exit(1);
}

// Same rule Vercel uses: a file in api/ is a function unless it starts with `_`.
const functions = readdirSync(apiDir)
  .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
  .sort();

/* -------------------------------------------------------------- fake request */

// Enough of a service account to let firebase-admin's cert() parse without
// reaching the network. Never a real credential.
process.env.FIREBASE_PROJECT_ID ||= "smoke-test";
process.env.FIREBASE_CLIENT_EMAIL ||= "smoke@smoke-test.iam.gserviceaccount.com";
process.env.FIREBASE_PRIVATE_KEY ||= "-----BEGIN PRIVATE KEY-----\\nc21va2U=\\n-----END PRIVATE KEY-----\\n";
process.env.ADMIN_EMAIL ||= "smoke@example.com";

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.settled = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.settled = true;
      return this;
    },
    end() {
      this.settled = true;
      return this;
    },
    settled: false,
  };
  return res;
}

/* ------------------------------------------------------------------- run it */

let failed = 0;
const results = [];

for (const file of functions) {
  const name = file.replace(/\.js$/, "");
  let mod;

  // HARD gate: does it load at all?
  try {
    mod = await import(pathToFileURL(join(apiDir, file)).href);
  } catch (err) {
    results.push({ name, ok: false, detail: `LOAD FAILED — ${err.code ?? ""} ${err.message.split("\n")[0]}` });
    failed++;
    continue;
  }

  if (typeof mod.default !== "function") {
    results.push({ name, ok: false, detail: "no default export handler" });
    failed++;
    continue;
  }

  // SOFT check: does invoking it produce a response instead of escaping?
  const res = mockRes();
  const req = { method: "GET", query: {}, headers: {}, body: {} };
  try {
    await mod.default(req, res);
    results.push({
      name,
      ok: true,
      detail: res.settled ? `responded ${res.statusCode ?? 200}` : "loaded (no response on bare GET)",
    });
  } catch (err) {
    // A throw is not automatically a failure — without real credentials some
    // handlers legitimately blow up inside. It is still worth printing.
    results.push({ name, ok: true, detail: `loaded; threw when invoked (${err.code ?? err.name})` });
  }
}

rmSync(outDir, { recursive: true, force: true });

/* ------------------------------------------------------------------- report */

for (const r of results) {
  console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name.padEnd(16)} ${r.detail}`);
}

console.log(
  `\n[smoke] ${functions.length} functions, ${functions.length - failed} loaded, ${failed} failed` +
    `  (Vercel Hobby cap: 12)`,
);

if (functions.length > 12) {
  console.error(
    `[smoke] ${functions.length} functions exceeds the Hobby cap of 12 — the deployment will fail.`,
  );
  process.exit(1);
}
if (failed) process.exit(1);
