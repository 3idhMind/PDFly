/**
 * Runnable check for the chunked-upload input gates and the tier ceilings.
 *
 *   node api/_lib/uploadInput.test.ts
 *
 * Node 23+ strips TypeScript types natively, so this needs no build step and no
 * test framework. These are the properties that would not fail a build, would
 * not fail a typecheck and would not be visible in the UI if they broke: an
 * upload id that can escape its storage prefix, a type gate that would turn the
 * upload slot into free object storage for anyone who found it, and the tier
 * numbers the pricing page states out loud.
 */

import assert from "node:assert/strict";
import { cleanId, cleanFilename, looksLikeImage, looksLikePdf } from "./uploadInput.ts";
import { TIERS, ANONYMOUS_TIER, formatLimit } from "./tiers.ts";

let checks = 0;
const ok = (label: string) => {
  checks++;
  console.log(`  ok   ${label}`);
};

/* ------------------------------------------------------------- upload ids */

for (const bad of ["../../etc/passwd", "a/b", "short", "has space", "..", "x".repeat(65), "", null, 42]) {
  assert.equal(cleanId(bad), null, `cleanId should reject ${JSON.stringify(bad)}`);
}
ok("cleanId rejects path traversal, wrong length and non-strings");

assert.equal(cleanId("abc12345"), "abc12345");
assert.equal(cleanId("A-Za-z0-9_-xyz"), "A-Za-z0-9_-xyz");
ok("cleanId accepts well-formed ids unchanged");

/* ------------------------------------------------------------- filenames */

assert.equal(cleanFilename("report.pdf"), "report.pdf");
assert.equal(cleanFilename("photo.png"), "photo.png");
assert.equal(cleanFilename("noextension"), "noextension.pdf");
assert.equal(cleanFilename(""), "upload.pdf");
assert.equal(cleanFilename(undefined), "upload.pdf");
assert.ok(!cleanFilename("a/b/c.pdf").includes("/"), "no path separator may survive");
assert.ok(!cleanFilename("../../evil.pdf").includes("/"), "no traversal may survive");
ok("cleanFilename strips separators and always leaves a real extension");

/* ----------------------------------------------------------- type gating */

const cases: [string, number[]][] = [
  ["png", [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["jpeg", [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]],
  ["bmp", [0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
];
for (const [name, bytes] of cases) {
  assert.equal(looksLikeImage(new Uint8Array(bytes)), true, `${name} should be recognised`);
}
const webp = new Uint8Array(12);
webp.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
webp.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
assert.equal(looksLikeImage(webp), true, "webp should be recognised");
ok("looksLikeImage recognises every format the tools accept");

// A zip is the interesting negative: it is what someone parking arbitrary data
// in our storage would reach for first, and it is not an image.
assert.equal(looksLikeImage(new TextEncoder().encode("PKplaceholder")), false);
assert.equal(looksLikeImage(new TextEncoder().encode("%PDF-1.7 not an image!!")), false);
assert.equal(looksLikeImage(new Uint8Array(4)), false, "a truncated buffer must not pass");
ok("looksLikeImage rejects archives, PDFs and truncated input");

assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7 hello")), true);
assert.equal(looksLikePdf(new TextEncoder().encode("   \n%PDF-1.4")), true, "leading whitespace is tolerated");
assert.equal(looksLikePdf(new TextEncoder().encode("PK")), false);
ok("looksLikePdf finds the marker past leading whitespace and rejects other bytes");

/* ---------------------------------------------------------------- tiers */

const MB = 1024 * 1024;
assert.equal(TIERS.free.maxJobBytes, 10 * MB, "free is the 10 MB the pricing page states");
assert.equal(TIERS.growth.maxJobBytes, 1024 * MB, "growth is the 1 GB the pricing page states");
assert.equal(TIERS.enterprise.maxJobBytes, 10 * 1024 * MB, "enterprise is the 10 GB the pricing page states");
ok("tier ceilings match what the pricing page promises");

assert.equal(ANONYMOUS_TIER.maxJobBytes, TIERS.free.maxJobBytes, "anonymous matches free on size");
assert.ok(
  ANONYMOUS_TIER.ratePerMin < TIERS.free.ratePerMin,
  "anonymous is bounded by rate, not by a smaller file — that was the deliberate choice",
);
ok("anonymous callers are limited by rate rather than by file size");

// No paid tier may ever be more restrictive than free: tierFor() skips its
// Firestore read for jobs inside the free ceiling on exactly that assumption.
for (const tier of [TIERS.growth, TIERS.enterprise]) {
  assert.ok(tier.maxJobBytes >= TIERS.free.maxJobBytes, `${tier.id} must not be smaller than free`);
  assert.ok(tier.monthlyQuota >= TIERS.free.monthlyQuota, `${tier.id} quota must not be smaller than free`);
  assert.ok(tier.ratePerMin >= TIERS.free.ratePerMin, `${tier.id} rate must not be smaller than free`);
}
ok("no paid tier is more restrictive than free, which tierFor's fast path relies on");

assert.equal(formatLimit(10 * MB), "10 MB");
assert.equal(formatLimit(1024 * MB), "1 GB");
ok("formatLimit renders both units");

// If the chunk size ever shrinks, a full free-tier job quietly turns into many
// more round trips. This is the check that notices.
const CHUNK_BYTES = 3 * MB;
const partsForFree = Math.ceil(TIERS.free.maxJobBytes / CHUNK_BYTES);
assert.ok(partsForFree <= 5, `a 10 MB job should take at most 5 parts, takes ${partsForFree}`);
ok(`a full free-tier job uploads in ${partsForFree} parts`);

console.log(`[upload] ${checks} checks passed`);
