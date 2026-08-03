// Caret preservation across whole-text rewrites (applyFixes; the panel's
// replace-all and collapse actions share the same mapping function).
//
// Every case is written in caret notation: "|" marks the caret, so each
// expectation is a picture of the textarea before and after. No offsets.
// Run: node test/node/caret.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();

// caretAfterRewrite is module-private; extract its exact source so the test
// always runs the shipped implementation.
const src = H.read("mcphee.js");
const m = src.match(/function caretAfterRewrite\([\s\S]*?\n  \}/);
if (!m) { console.error("FAIL  could not extract caretAfterRewrite"); process.exit(1); }
const caretAfterRewrite = require("vm").runInNewContext("(" + m[0] + ")");

// The old textarea state (with caret) plus the rewritten text should place
// the caret as pictured in `want`.
function checkMap(oldNotated, newPlain, want, label) {
  const o = H.fromNotation(oldNotated);
  const caret = caretAfterRewrite(o.text, newPlain, o.caret);
  H.eq(H.toNotation(newPlain, caret), want, label);
}

async function checkFix(checker, before, want, label) {
  const o = H.fromNotation(before);
  const ta = H.fakeTextarea(o.text, o.caret);
  const fix = checker.applyFixes(ta);
  H.eq(H.toNotation(ta.value, ta.selectionStart), want, label);
  return fix;
}

async function main() {
  // --- caretAfterRewrite: pure mapping ---
  checkMap("ab|c", "abc", "ab|c", "identical text keeps caret");
  checkMap("teh c|at", "the cat", "the c|at", "caret in unchanged suffix keeps its spot");
  checkMap("|teh cat", "the cat", "|the cat", "caret at start keeps its spot");
  checkMap("ab  cd|", "ab cd", "ab cd|", "caret at old end maps to new end");
  checkMap("|ab  cd", "ab cd", "|ab cd", "caret before change unchanged");
  checkMap("ab  |cd", "ab cd", "ab |cd", "caret inside changed region lands at its end");
  checkMap("x|", "x plus more", "x| plus more", "caret stays put when text is appended after it");

  // --- applyFixes: caret survives the one-step whole-text rewrite ---
  const checker = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_dict_caret",
  });

  const fix1 = await checkFix(checker,
    "The d|og sat. teh cat ran fast here.",
    "The d|og sat. the cat ran fast here.",
    "caret before the change stays exactly");
  H.ok(fix1.applied, "applyFixes applied a fix");

  await checkFix(checker,
    "teh cat sat here now.|",
    "the cat sat here now.|",
    "caret at old end maps to new end");

  await checkFix(checker,
    "big    cat sat |here",
    "big cat sat |here",
    "caret after a collapsed space run shifts by the delta");

  const fix4 = await checkFix(checker,
    "All |clean here.",
    "All |clean here.",
    "clean text: caret untouched");
  H.ok(!fix4.applied, "clean text applies nothing");

  H.finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
