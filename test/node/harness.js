// Shared harness for the Node analysis-layer tests.
//
// What lives here:
//   - makeSandbox(): a minimal browser-ish VM context with the library and
//     Typo loaded, localStorage stubbed, and fetch served from local files.
//   - ok/eq/finish: assertion counters with the ok/FAIL output convention.
//   - Caret notation: tests describe textarea states as plain strings with a
//     "|" marking the caret ("teh |cat"), so expectations read as pictures of
//     the textarea instead of offset arithmetic.
//   - fakeTextarea(): the minimal textarea surface applyFixes needs.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

function makeSandbox() {
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
  return sandbox;
}

let failures = 0;

function ok(cond, label) {
  console.log((cond ? "ok    " : "FAIL  ") + label);
  if (!cond) failures++;
}

function eq(got, want, label) {
  ok(got === want, label + (got === want ? "" : " (got " + JSON.stringify(got) + ", want " + JSON.stringify(want) + ")"));
}

function finish() {
  console.log(failures ? "\n" + failures + " FAILURES" : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

// --- caret notation ---

function fromNotation(s) {
  const caret = s.indexOf("|");
  if (caret < 0) throw new Error('caret notation requires a "|": ' + s);
  return { text: s.slice(0, caret) + s.slice(caret + 1), caret };
}

function toNotation(text, caret) {
  return text.slice(0, caret) + "|" + text.slice(caret);
}

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

module.exports = { root, read, makeSandbox, ok, eq, finish, fromNotation, toNotation, fakeTextarea };
