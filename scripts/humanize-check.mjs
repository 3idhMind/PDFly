#!/usr/bin/env node
/**
 * Checks a piece of prose for the tells that make content read as
 * machine-generated: banned phrases, leftover template artifacts, and
 * statistical uniformity a human writer rarely produces by accident.
 *
 * ── Why this exists as a separate script, not just the server-side BANNED list ───
 * `api/_lib/handlers/blogHandler.ts` already rejects a handful of banned phrases
 * with a 400 on publish — that check has to be cheap and unambiguous, since it
 * runs on every request. This script is the heavier pass: it also catches
 * leftover template artifacts (an unfilled `{{name}}`, a truncated suffix like
 * `-M` or `-S` left over from a slug or ID generator, doubled spaces, repeated
 * words) and reports paragraph-length variance, which the server-side check
 * cannot cheaply do. Run this BEFORE publishing, not instead of the server
 * check — both matter, they catch different things.
 *
 * ── The "-M / -S" complaint, specifically ─────────────────────────────────
 * The founder flagged stray fragments like " -M" or " -S" showing up in
 * published text — almost always a truncated size/variant suffix (a leftover
 * from copy-pasting a filename, an ID, or a template value) that never got
 * cleaned up. ARTIFACT_PATTERNS below catches the general shape: a space or
 * word boundary, a dash, then one or two bare uppercase letters with nothing
 * after them. This is a narrow, deliberately conservative pattern — it must
 * not flag legitimate short-form usage like "U-S" abbreviations spelled with
 * periods, or "X-ray", which have a period or lowercase letter following.
 *
 * Usage:
 *   node scripts/humanize-check.mjs path/to/post.json
 *   node scripts/humanize-check.mjs --stdin < post.txt
 *   echo '{"content":"..."}' | node scripts/humanize-check.mjs --stdin
 *
 * Exit code 0 = clean, 1 = at least one problem found. Never modifies the
 * input; this only reports.
 */

import { readFileSync } from "node:fs";

/* --------------------------------------------------------- banned phrases */
/**
 * Superset of api/_lib/handlers/blogHandler.ts's BANNED list, plus more of
 * the specific tells GPT-style models default to when not told otherwise.
 * Keep the two lists in sync when adding to either — the server list must
 * stay conservative (a false positive there is a hard 400 on a real publish
 * attempt); this list can be a little more aggressive since it only warns.
 */
const BANNED_PHRASES = [
  { pattern: /[—–]/, why: "em/en dash" },
  { pattern: /\bdelve\b/i, why: '"delve"' },
  { pattern: /\bleverage\b/i, why: '"leverage"' },
  { pattern: /\bseamless(ly)?\b/i, why: '"seamless"' },
  { pattern: /\brobust\b/i, why: '"robust"' },
  { pattern: /\bin today's fast[- ]paced\b/i, why: '"in today\'s fast-paced"' },
  { pattern: /\bit's not just .{1,40}, it's\b/i, why: '"it\'s not just X, it\'s Y"' },
  { pattern: /\bunlock(ing)?\b/i, why: '"unlock/unlocking"' },
  { pattern: /\bgame[- ]chang(ing|er)\b/i, why: '"game-changing/game-changer"' },
  { pattern: /\bcutting[- ]edge\b/i, why: '"cutting-edge"' },
  { pattern: /\bdive (in|into)\b/i, why: '"dive in/into"' },
  { pattern: /\bnavigate the\b/i, why: '"navigate the"' },
  { pattern: /\bin conclusion\b/i, why: '"in conclusion"' },
  { pattern: /\bfurthermore\b/i, why: '"furthermore"' },
  { pattern: /\bmoreover\b/i, why: '"moreover"' },
  { pattern: /\bit is worth noting\b/i, why: '"it is worth noting"' },
  { pattern: /\bwhether you're .{1,40} or .{1,40}\b/i, why: '"whether you\'re X or Y" filler' },
  { pattern: /\bat the end of the day\b/i, why: '"at the end of the day"' },
  { pattern: /\bin the world of\b/i, why: '"in the world of"' },
  { pattern: /\bplays a (crucial|vital|key) role\b/i, why: '"plays a crucial/vital/key role"' },
];

/* --------------------------------------------------------- artifact junk */
const ARTIFACT_PATTERNS = [
  {
    // " -M", " -S", "(-XL" etc: a dash then 1-3 bare capitals with a word
    // boundary right after. Deliberately requires the boundary so "X-ray" and
    // "U.S.-based" do not false-positive.
    pattern: /(?:^|\s|\()-[A-Z]{1,3}\b(?![.\w])/,
    why: "stray truncated suffix (e.g. \"-M\", \"-S\") — usually a leftover template or filename fragment",
  },
  { pattern: /\{\{[^}]*\}\}/, why: "unfilled template placeholder {{...}}" },
  { pattern: /\{%[^%]*%\}/, why: "unfilled template tag {%...%}" },
  { pattern: /\[object Object\]/, why: "a stringified JS object leaked into the text" },
  { pattern: /\bundefined\b|\bNaN\b|\bnull\b/, why: "a literal undefined/NaN/null leaked into the text" },
  { pattern: /  +/, why: "double (or more) space" },
  { pattern: /\t/, why: "literal tab character" },
  { pattern: /\b(\w+)\s+\1\b/i, why: "repeated word (\"the the\", \"a a\")" },
  { pattern: /[ \t]+\n/, why: "trailing whitespace at end of a line" },
  { pattern: / /, why: "non-breaking space (usually a copy-paste artifact)" },
  { pattern: /[￰-￿﻿]/, why: "stray Unicode control/specials character" },
];

/* --------------------------------------------------------- prose statistics */
/**
 * Paragraph-length variance. Machine-generated prose tends toward suspiciously
 * uniform paragraph lengths; real writing is uneven. Not a hard fail, a
 * warning — a genuinely short, punchy post can legitimately have low variance.
 */
function statsCheck(content) {
  const paras = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#") && !p.startsWith("```"));
  if (paras.length < 3) return { ok: true, note: "too few paragraphs to judge variance" };

  const lens = paras.map((p) => p.split(/\s+/).length);
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length);
  const ratio = sd / avg;

  const sentences = content.split(/[.!?]+\s/).filter((s) => s.trim().length > 3);
  const sLens = sentences.map((s) => s.split(/\s+/).length);
  const hasShortPunch = sLens.some((n) => n <= 8);

  return {
    ok: ratio >= 0.35 && hasShortPunch,
    ratio: ratio.toFixed(2),
    paragraphs: lens.length,
    hasShortPunch,
    note:
      ratio < 0.35
        ? "paragraph lengths are suspiciously uniform (ratio < 0.35) — vary sentence and paragraph length"
        : !hasShortPunch
          ? "no short punchy sentences (<=8 words) — real writing usually has at least one"
          : "looks varied",
  };
}

/* --------------------------------------------------------------------- run */

function checkText(label, text) {
  const problems = [];
  for (const { pattern, why } of BANNED_PHRASES) {
    if (pattern.test(text)) problems.push({ type: "banned-phrase", why });
  }
  for (const { pattern, why } of ARTIFACT_PATTERNS) {
    if (pattern.test(text)) problems.push({ type: "artifact", why });
  }
  const stats = statsCheck(text);

  console.log(`\n${label}`);
  if (problems.length === 0) {
    console.log("  ok    no banned phrases or artifacts found");
  } else {
    for (const p of problems) console.log(`  FAIL  [${p.type}] ${p.why}`);
  }
  console.log(
    `  ${stats.ok ? "ok  " : "warn"}  paragraph variance ${stats.ratio ?? "n/a"} (${stats.paragraphs ?? 0} paragraphs) — ${stats.note}`,
  );

  return problems.length === 0;
}

const args = process.argv.slice(2);
let ok = true;

if (args.includes("--stdin")) {
  const raw = readFileSync(0, "utf8");
  let text = raw;
  try {
    const parsed = JSON.parse(raw);
    text = [parsed.title, parsed.excerpt, parsed.content].filter(Boolean).join("\n\n");
  } catch {
    /* plain text, use as-is */
  }
  ok = checkText("(stdin)", text);
} else if (args.length > 0) {
  for (const file of args) {
    const raw = readFileSync(file, "utf8");
    let text = raw;
    try {
      const parsed = JSON.parse(raw);
      text = [parsed.title, parsed.excerpt, parsed.content].filter(Boolean).join("\n\n");
    } catch {
      /* plain text file */
    }
    if (!checkText(file, text)) ok = false;
  }
} else {
  console.error("Usage: node scripts/humanize-check.mjs <file.json...> | --stdin");
  process.exit(1);
}

console.log(`\n${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
