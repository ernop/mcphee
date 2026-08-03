// Node smoke test for McPhee v3.6.2: caret preservation across whole-text
// rewrites (applyFixes and the panel's replace-all/collapse actions share
// the same principle; caretAfterRewrite is the pure mapping function).
// Run: node test/node-smoke-3.6.2.js  (from the repo root)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const storage = new Map();
const sandbox = {
  console,
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  window: {},
  document: undefined,
  Event: class Event { constructor(type) { this.type = type; } },
  setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("vendor/typo/typo.min.js"), sandbox);
vm.runInContext(read("mcphee.js"), sandbox);

sandbox.fetch = (url) => {
  const rel = String(url).replace(/^.*vendor\//, "vendor/");
  return Promise.resolve({ ok: true, text: () => Promise.resolve(read(rel)) });
};

// caretAfterRewrite is module-private; extract its exact source so the test
// always runs the shipped implementation.
const src = read("mcphee.js");
const m = src.match(/function caretAfterRewrite\([\s\S]*?\n  \}/);
if (!m) { console.error("FAIL  could not extract caretAfterRewrite"); process.exit(1); }
const caretAfterRewrite = vm.runInNewContext("(" + m[0] + ")");

function fakeTextarea(value, caret) {
  return {
    value,
    selectionStart: caret,
    selectionEnd: caret,
    focus() {},
    setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
    setRangeText(replacement, start, end) {
      this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
      this.selectionStart = this.selectionEnd = start + replacement.length;
    },
    dispatchEvent() {},
  };
}

async function main() {
  let failures = 0;
  const assert = (cond, label) => {
    console.log((cond ? "ok    " : "FAIL  ") + label);
    if (!cond) failures++;
  };
  const assertEq = (got, want, label) => assert(got === want, label + " (got " + got + ", want " + want + ")");

  // --- caretAfterRewrite: pure mapping ---
  assertEq(caretAfterRewrite("abc", "abc", 2), 2, "identical text keeps caret");
  assertEq(caretAfterRewrite("teh cat", "the cat", 5), 5, "caret in unchanged suffix keeps its spot");
  assertEq(caretAfterRewrite("teh cat", "the cat", 0), 0, "caret at start keeps its spot");
  assertEq(caretAfterRewrite("ab  cd", "ab cd", 6), 5, "caret at old end maps to new end");
  assertEq(caretAfterRewrite("ab  cd", "ab cd", 0), 0, "caret before change unchanged");
  assertEq(caretAfterRewrite("ab  cd", "ab cd", 4), 3, "caret inside changed region lands at its end");
  assertEq(caretAfterRewrite("x", "x plus more", 1), 1, "caret stays put when text is appended after it");

  // --- applyFixes: caret survives the one-step whole-text rewrite ---
  const checker = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_dict_362",
  });

  // Caret in clean text BEFORE the fixes: must not move.
  let ta = fakeTextarea("The dog sat. teh cat ran fast here.", 5);
  let fix = checker.applyFixes(ta);
  assert(fix.applied, "applyFixes applied a fix");
  assertEq(ta.value, "The dog sat. the cat ran fast here.", "teh corrected to the");
  assertEq(ta.selectionStart, 5, "caret before the change stays exactly");

  // Caret at the very end: must map to the new end, not beyond.
  ta = fakeTextarea("teh cat sat here now.", 21);
  fix = checker.applyFixes(ta);
  assert(fix.applied, "second fix applied");
  assertEq(ta.selectionStart, ta.value.length, "caret at old end maps to new end");

  // Caret in clean text AFTER the fixes: offset shifts by the length delta.
  ta = fakeTextarea("big    cat sat here", 15); // caret on 'h'; run collapses 4->1
  fix = checker.applyFixes(ta);
  assertEq(ta.value, "big cat sat here", "illegitimate run collapsed");
  assertEq(ta.selectionStart, 12, "caret after the change shifts by the delta");

  // No fixes -> caret untouched.
  ta = fakeTextarea("All clean here.", 4);
  fix = checker.applyFixes(ta);
  assert(!fix.applied, "clean text applies nothing");
  assertEq(ta.selectionStart, 4, "caret untouched when nothing applied");

  console.log(failures ? "\n" + failures + " FAILURES" : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
