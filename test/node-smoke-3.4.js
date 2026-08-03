// Node smoke test for McPhee v3.4.0 analysis changes: culture rule,
// persistent ignore list, formality profiles, rule overrides surface.
// Run: node test/node-smoke-3.4.js  (from the repo root)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// Minimal browser-ish sandbox.
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
  setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(read("vendor/typo/typo.min.js"), sandbox);
vm.runInContext(read("mcphee.js"), sandbox);

const Typo = sandbox.Typo;
const McPhee = sandbox.McPhee;

const dict = new Typo("en_US", read("vendor/typo/en_US.aff"), read("vendor/typo/en_US.dic"));

// Build the checker the way create() does, but synchronously.
// create() fetches assets; here we call the internal constructor through
// McPhee.create's plumbing is async/fetch-based, so replicate: analyze via a
// checker obtained from create with stubbed fetch.
const freqLines = read("vendor/wordfreq/en-30k.txt").split("\n");
const freqRank = new Map();
freqLines.forEach((w, i) => { w = w.trim(); if (w) freqRank.set(w, i + 1); });

sandbox.fetch = null; // ensure nothing tries to fetch

// Access the Checker through a tiny shim: McPhee.create is async; instead
// use the exported profiles + a constructed instance via Function hack is
// fragile. Simpler: re-run mcphee.js body is already done; McPhee only
// exposes create/version/profiles. So test through create() with a fake
// fetch that serves local files.
async function main() {
  sandbox.fetch = (url) => {
    const rel = String(url).replace(/^.*vendor\//, "vendor/");
    const body = read(rel);
    return Promise.resolve({ ok: true, text: () => Promise.resolve(body) });
  };
  const checker = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    freqUrl: "vendor/wordfreq/en-30k.txt",
    customDictStorageKey: "test_dict",
  });

  let failures = 0;
  const assert = (cond, label) => {
    if (cond) console.log("ok    " + label);
    else { failures++; console.log("FAIL  " + label); }
  };
  const kinds = (text, opts) => checker.analyze(text, opts).map(i => i.kind + ":" + i.value);

  // --- culture rule ---
  const t1 = checker.analyze("the japanese visited usa last year.");
  assert(t1.some(i => i.kind === "culture" && i.value === "japanese" && i.expected === "Japanese"), "culture flags 'japanese' -> Japanese");
  assert(t1.some(i => i.kind === "culture" && i.value === "usa" && i.expected === "USA"), "culture flags 'usa' -> USA");
  assert(!checker.analyze("The Japanese visited the USA.").some(i => i.kind === "culture"), "properly cased forms not flagged");
  assert(!checker.analyze("the turkey and china plates were polished.").some(i => i.kind === "culture"), "ambiguous words (turkey/china) excluded");
  assert(!checker.analyze("the japanese visited.", { profile: "casual" }).some(i => i.kind === "culture"), "casual profile disables culture");
  assert(!checker.analyze("english people dont mind.").some(i => i.kind === "word" && i.value === "english"), "'english' is culture, not unknown-word");

  // --- ignore list ---
  checker.ignoreWord("Helbro");
  assert(!checker.analyze("Helbro is here.").some(i => i.value === "Helbro"), "ignored word not flagged");
  assert(checker.listIgnoredWords().includes("helbro"), "ignore list stores lowercase");
  checker.unignoreWord("helbro");
  assert(checker.analyze("Helbro is here.").some(i => i.value === "Helbro"), "unignored word flagged again");
  checker.ignoreWord("a1"); checker.ignoreWord("b2");
  checker.unignoreAll();
  assert(checker.listIgnoredWords().length === 0, "unignoreAll clears the list");

  // --- ignore also silences culture ---
  checker.ignoreWord("japanese");
  assert(!checker.analyze("the japanese visited.").some(i => i.kind === "culture"), "ignored word skips culture flag too");
  checker.unignoreWord("japanese");

  // --- formality profiles map ---
  assert(McPhee.profiles.standard.culture === true, "standard profile includes culture");
  assert(McPhee.profiles.casual.culture === false, "casual profile excludes culture");
  assert(McPhee.profiles.strict.sentenceCapitalization === true, "strict includes sentenceCapitalization");

  // --- custom dictionary beats culture ---
  checker.addCustomWord("usa");
  assert(!checker.analyze("usa is big.").some(i => i.kind === "culture"), "+dict word exempt from culture");
  checker.removeCustomWord("usa");

  // --- regression: base rules still fire ---
  const t2 = kinds("teh cat   sat wierd.");
  assert(t2.some(k => k === "word:teh"), "misspelled still flagged");
  assert(t2.some(k => k.startsWith("doublespace:")), "triple space still flagged");

  console.log(failures ? "\n" + failures + " FAILURES" : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
