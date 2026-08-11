/**
 * Runnable check for the API key security path.
 *
 *   node api/_lib/apiKeys.test.ts
 *
 * Node 23+ strips TypeScript types natively, so this needs no build step and no
 * test framework. It exists because these are the properties that, if they
 * quietly broke, would not fail a build, would not fail a typecheck, and would
 * not be visible in the UI — they would just silently weaken the keys.
 */

import assert from "node:assert/strict";
import {
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  safeEqualHex,
  redact,
  KEY_PREFIX,
} from "./apiKeys.ts";

let checks = 0;
const check = (label: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`  ok  ${label}`);
};

console.log("apiKeys");

check("key carries the public prefix", () => {
  assert.ok(generateApiKey().raw.startsWith(KEY_PREFIX));
});

check("key has >=256 bits of entropy encoded", () => {
  const { raw } = generateApiKey();
  const random = raw.slice(KEY_PREFIX.length);
  // 32 bytes in base64url, unpadded → 43 chars.
  assert.equal(random.length, 43);
  assert.match(random, /^[A-Za-z0-9_-]+$/);
});

check("keys are unique across many generations", () => {
  const seen = new Set(Array.from({ length: 5000 }, () => generateApiKey().raw));
  assert.equal(seen.size, 5000);
});

check("hash is stable, 64 hex chars, and matches a known vector", () => {
  const h = hashApiKey("pdfly_live_test");
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashApiKey("pdfly_live_test"));
  // Guards against someone "improving" the algorithm or the encoding later.
  assert.equal(
    hashApiKey("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

check("different keys never share a hash", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.notEqual(a.hash, b.hash);
});

check("stored prefix reveals only a few characters of the secret", () => {
  const { raw, prefix } = generateApiKey();
  assert.ok(raw.startsWith(prefix));
  // Whatever is displayed must be a tiny fraction of the whole key.
  assert.ok(prefix.length < raw.length / 3, "prefix leaks too much of the key");
  assert.equal(prefix.length, KEY_PREFIX.length + 4);
});

check("generated keys pass shape validation, junk does not", () => {
  assert.equal(looksLikeApiKey(generateApiKey().raw), true);
  for (const bad of ["", "pdfly_live_", "pdfgen_abc", "Bearer x", KEY_PREFIX + "short"]) {
    assert.equal(looksLikeApiKey(bad), false, `should reject: ${JSON.stringify(bad)}`);
  }
  // A Firebase ID token must never be mistaken for an API key — that is what
  // routes a caller down the right verification branch.
  assert.equal(looksLikeApiKey("eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.eyJzdWIiOiIxIn0.sig"), false);
});

check("safeEqualHex compares correctly and rejects mismatched input", () => {
  const h = hashApiKey("x");
  assert.equal(safeEqualHex(h, h), true);
  assert.equal(safeEqualHex(h, hashApiKey("y")), false);
  assert.equal(safeEqualHex(h, h.slice(0, 10)), false);
});

check("safeEqualHex rejects non-hex input instead of decoding it to nothing", () => {
  // Regression guard. Buffer.from(s,"hex") silently yields an empty buffer for
  // invalid input, and timingSafeEqual(empty, empty) is true — so without an
  // alphabet check these all compared EQUAL. Found by this test, not in review.
  assert.equal(safeEqualHex("zz", "zz"), false);
  assert.equal(safeEqualHex("zzzz", "yyyy"), false);
  assert.equal(safeEqualHex("gggggggg", "hhhhhhhh"), false);
  assert.equal(safeEqualHex("", ""), false);
  assert.equal(safeEqualHex("abc", "abd"), false); // odd length
  // Mixed case hex of the same value is still a valid comparison.
  assert.equal(safeEqualHex("ABCD", "abcd"), true);
});

check("redact strips key-shaped strings from log lines", () => {
  const { raw } = generateApiKey();
  const line = redact(`request failed for ${raw} at /api/keys`);
  assert.ok(!line.includes(raw), "raw key survived redaction");
  assert.ok(line.includes("…redacted"));
});

console.log(`\n${checks} checks passed`);
