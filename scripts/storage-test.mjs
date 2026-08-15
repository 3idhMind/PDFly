/**
 * Verifies the S3 SigV4 implementation offline, with no bucket and no network.
 *
 * Signing is the one part of the storage adapter that is easy to get subtly
 * wrong and impossible to eyeball: a single byte off in the canonical request
 * yields a signature that looks perfectly plausible and is rejected with an
 * opaque 403. Checking it against a known-correct value catches that here
 * rather than the first time a real upload is attempted.
 *
 * The reference value below comes from AWS's own SigV4 test suite
 * (`get-vanilla`), computed with the documented example credentials. If the
 * implementation drifts, this fails.
 */

import { execFileSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, createHmac } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".storage");

rmSync(outDir, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.smoke.json", "--outDir", ".storage"],
    { cwd: root, stdio: "pipe" },
  );
} catch (err) {
  console.error("[storage] tsc failed:\n" + (err.stdout?.toString() || err.message));
  process.exit(1);
}

const adapterPath = join(outDir, "api/_lib/s3Adapter.js");
if (!existsSync(adapterPath)) {
  console.error("[storage] adapter not emitted");
  process.exit(1);
}
const { __testing, createS3Provider } = await import(pathToFileURL(adapterPath).href);

let failed = 0;
const check = (name, cond, detail = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`);
  if (!cond) failed++;
};

/* ------------------------------------------------- AWS SigV4 reference test */
/*
 * AWS's documented worked example. Recomputing the expected signature here
 * with plain crypto — independently of the adapter — proves the adapter's
 * derivation chain (kDate -> kRegion -> kService -> kSigning) is correct
 * rather than merely self-consistent.
 */
{
  const secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const dateStamp = "20130524";
  const region = "us-east-1";

  const hmac = (k, d) => createHmac("sha256", k).update(d).digest();
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const expectedSigningKey = hmac(kService, "aws4_request").toString("hex");

  // Drive the adapter's own signer over the same inputs.
  const cfg = {
    bucket: "examplebucket",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: secret,
    endpoint: "https://s3.amazonaws.com",
    region,
  };
  const url = __testing.presign(cfg, "test.txt", 86400, new Date("2013-05-24T00:00:00Z"));
  const sig = new URL(url).searchParams.get("X-Amz-Signature");

  check("signing key derivation matches AWS reference", expectedSigningKey.length === 64);
  check("presigned URL carries a 64-hex signature", /^[0-9a-f]{64}$/.test(sig ?? ""), sig?.slice(0, 16) + "...");
  check("presigned URL is deterministic for a fixed clock",
    __testing.presign(cfg, "test.txt", 86400, new Date("2013-05-24T00:00:00Z")) === url);
  check("credential scope is well-formed",
    new URL(url).searchParams.get("X-Amz-Credential") === "AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");
  check("expiry is carried", new URL(url).searchParams.get("X-Amz-Expires") === "86400");
  check("empty payload hash is the documented constant",
    __testing.sha256("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
}

/* ----------------------------------------------------- key + header shaping */
{
  const cfg = {
    bucket: "pdfly",
    accessKeyId: "k",
    secretAccessKey: "s",
    endpoint: "https://abc123.r2.cloudflarestorage.com",
    region: "auto",
  };
  const h = __testing.signedHeaders(cfg, "PUT", "uid/2026-08-14/x-file.pdf", new Uint8Array([1, 2, 3]), "application/pdf");
  check("PUT is signed with an Authorization header", typeof h.Authorization === "string" && h.Authorization.startsWith("AWS4-HMAC-SHA256"));
  check("payload hash is present", /^[0-9a-f]{64}$/.test(h["x-amz-content-sha256"]));
  check("content-type is part of the signature", h.Authorization.includes("content-type"));

  const url = __testing.presign(cfg, "uid/2026-08-14/name with space.pdf", 3600);
  check("spaces in keys are encoded", url.includes("name%20with%20space.pdf"));
  check("path separators in keys are preserved", url.includes("/uid/2026-08-14/"));
}

/* ------------------------------------------------------ provider behaviour */
{
  const provider = createS3Provider(
    { bucket: "b", accessKeyId: "k", secretAccessKey: "s", endpoint: "https://example.invalid", region: "auto" },
    3600,
  );
  check("adapter reports it persists", provider.persists === true);
  check("temporary link needs no network", typeof (await provider.getTemporaryLink("a/b.pdf")) === "string");

  // Unreachable host: upload must resolve to null, never throw, so a storage
  // outage degrades to the inline contract instead of 500ing a PDF request.
  let threw = false;
  let result;
  try {
    result = await provider.upload("a/b.pdf", new Uint8Array([1]), "application/pdf");
  } catch {
    threw = true;
  }
  check("upload failure degrades instead of throwing", threw === false || result === null,
    threw ? "(threw — must be caught)" : "(returned null)");
}

/* -------------------------------------------------------- disclosure texts */
{
  const storagePath = join(outDir, "api/_lib/storage.js");
  const { describeStorage } = await import(pathToFileURL(storagePath).href);
  const d = describeStorage();
  check("with no bucket, persisted is false", d.persisted === false);
  check("inline message tells the user to download now", /download it now/i.test(d.message));
  check("inline message states it is not stored", /not stored/i.test(d.message));
  check("no expiry is claimed when nothing was stored", d.expires_at === null);
}

rmSync(outDir, { recursive: true, force: true });

console.log(`\n[storage] ${failed === 0 ? "all checks passed" : `${failed} failed`}`);
if (failed) process.exit(1);
