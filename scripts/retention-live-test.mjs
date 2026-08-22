/**
 * Live end-to-end check of the one-hour retention promise.
 *
 *   node scripts/retention-live-test.mjs
 *
 * NOT part of `npm run verify`: it needs real FILEN_* and FIREBASE_* credentials
 * and it talks to the actual storage account and the actual Firestore. It is the
 * only way to answer the question that matters — does the object really get
 * deleted, or does only the link stop working? Those are very different
 * promises, and the Privacy Policy makes the stronger one.
 *
 * The expiry is forced rather than waited out. Waiting an hour would test the
 * clock, which is not the part that can be wrong; writing an already-expired
 * row exercises the exact query, the exact delete and the exact ordering the
 * sweep uses in production.
 *
 * Everything it creates is namespaced under a `retention-live-test` key and
 * removed on the way out, including on failure.
 */

import { execFileSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".retention");

process.loadEnvFile(join(root, ".env"));

if (!process.env.FILEN_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error("[retention] needs FILEN_* and FIREBASE_* in .env. Skipping.");
  process.exit(1);
}

/* ------------------------------------------------------------------ compile */

rmSync(outDir, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.smoke.json", "--outDir", ".retention"],
    { cwd: root, stdio: "pipe" },
  );
} catch (err) {
  console.error("[retention] tsc failed:\n" + (err.stdout?.toString() || err.message));
  process.exit(1);
}

const storagePath = join(outDir, "api/_lib/storage.js");
if (!existsSync(storagePath)) {
  console.error("[retention] storage.js not emitted");
  process.exit(1);
}

const { storage, sweepExpired, RETENTION_SECONDS } = await import(pathToFileURL(storagePath).href);
const { db } = await import(pathToFileURL(join(outDir, "api/_lib/firebase.js")).href);

/* --------------------------------------------------------------------- run */

const provider = storage();
const stamp = randomUUID().slice(0, 8);
const expiredKey = `retention-live-test/${stamp}/expired.pdf`;
const liveKey = `retention-live-test/${stamp}/live.pdf`;
const payload = new TextEncoder().encode("%PDF-1.4\n% retention live test\n");

let failures = 0;
const check = (label, passed, detail = "") => {
  console.log(`  ${passed ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!passed) failures++;
};

const rows = [];

try {
  console.log(`[retention] provider=${provider.name} persists=${provider.persists} ttl=${RETENTION_SECONDS}s`);
  check("retention is the one hour the Privacy Policy promises", RETENTION_SECONDS === 3600, `${RETENTION_SECONDS}s`);

  /* 1. Two real objects in the real bucket. */
  const up1 = await provider.upload(expiredKey, payload, "application/pdf");
  const up2 = await provider.upload(liveKey, payload, "application/pdf");
  check("expired-case object uploaded", !!up1);
  check("control object uploaded", !!up2);
  if (!up1 || !up2) throw new Error("upload failed; cannot continue");

  check("expired-case object is really there", await provider.exists(expiredKey));
  check("control object is really there", await provider.exists(liveKey));

  /* 2. Index both, one already past its expiry and one not. */
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 3600_000).toISOString();

  for (const [key, expiresAt] of [[expiredKey, past], [liveKey, future]]) {
    const ref = await db().collection("storedFiles").add({
      key,
      uid: "retention-live-test",
      size: payload.length,
      expiresAt,
      provider: provider.name,
      createdAt: new Date().toISOString(),
    });
    rows.push(ref);
  }
  check("both rows indexed in Firestore", rows.length === 2);

  /* 3. The thing under test. */
  const result = await sweepExpired(200);
  console.log(`[retention] sweep reported deleted=${result.deleted} failed=${result.failed}`);
  check("sweep deleted at least the expired object", result.deleted >= 1, `deleted=${result.deleted}`);
  check("sweep reported no failures", result.failed === 0, `failed=${result.failed}`);

  /* 4. The claim that actually matters: the bytes are gone, not just the link. */
  check("EXPIRED OBJECT IS GONE FROM STORAGE", (await provider.exists(expiredKey)) === false);
  check("expired object cannot be downloaded", (await provider.download(expiredKey)) === null);

  /* 5. And the sweep did not overreach. */
  check("unexpired object was NOT touched", (await provider.exists(liveKey)) === true);

  /* 6. The index row went with it, so nothing is retried forever. */
  const expiredRow = await rows[0].get();
  check("expired row removed from the index", expiredRow.exists === false);
  const liveRow = await rows[1].get();
  check("unexpired row kept in the index", liveRow.exists === true);
} catch (err) {
  console.error(`[retention] threw: ${err.message}`);
  failures++;
} finally {
  // Leave nothing behind, whatever happened above.
  await provider.delete(expiredKey).catch(() => {});
  await provider.delete(liveKey).catch(() => {});
  for (const ref of rows) await ref.delete().catch(() => {});
  rmSync(outDir, { recursive: true, force: true });
}

console.log(
  failures === 0
    ? "\n[retention] one-hour auto-delete verified against the live backend"
    : `\n[retention] ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
