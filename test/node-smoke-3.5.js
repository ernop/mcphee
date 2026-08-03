// Node smoke test for McPhee v3.5.0: exclusion zones (options.exclude).
// Run: node test/node-smoke-3.5.js  (from the repo root)
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

const COMPONENT_RE = [/\{\{[\s\S]*?\}\}/g]; // fuseki's component blocks

async function main() {
  const checker = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    freqUrl: "vendor/wordfreq/en-30k.txt",
    customDictStorageKey: "test_dict_35",
    exclude: COMPONENT_RE,
  });

  let failures = 0;
  const assert = (cond, label) => {
    if (cond) console.log("ok    " + label);
    else { failures++; console.log("FAIL  " + label); }
  };

  // Misspellings, spaces, and culture words inside {{ }} are invisible.
  const t1 = checker.analyze("a wierd day. {{gallery photso=zzqx   usa japanese}} more prose.");
  assert(t1.some(i => i.value === "wierd"), "prose misspelling outside block still flagged");
  assert(!t1.some(i => i.value === "photso" || i.value === "zzqx"), "misspellings inside {{ }} invisible");
  assert(!t1.some(i => i.kind === "doublespace"), "space run inside {{ }} invisible");
  assert(!t1.some(i => i.kind === "culture"), "culture words inside {{ }} invisible");

  // Multiline blocks.
  const t2 = checker.analyze("clean text.\n{{map\n  zoom=12\n  layr=asdfgh\n}}\nclean end.");
  assert(t2.length === 0, "multiline {{ }} block fully invisible");

  // Repetition: an excluded occurrence is not an echo partner.
  const t3 = checker.analyze("The leopard slept. {{caption leopard}} It dreamed.");
  assert(!t3.some(i => i.kind === "echo"), "excluded word is no echo partner");
  const t4 = checker.analyze("The leopard slept near the leopard.");
  assert(t4.some(i => i.kind === "echo"), "echo still fires outside blocks");

  // localFix never touches excluded zones.
  const fix = checker.localFix("teh cat. {{cfg teh   x}} teh end.");
  assert(fix.text === "the cat. {{cfg teh   x}} the end.", "localFix fixes prose, leaves {{ }} intact");

  // concordance / repetitionReport skip excluded words.
  const conc = checker.concordance("leopard {{leopard leopard}} leopard", "leopard");
  assert(conc.count === 2, "concordance counts only prose occurrences");
  const rep = checker.repetitionReport("obstreperous prose {{obstreperous obstreperous}} text obstreperous");
  const row = rep.rows.find(r => r.key === "obstreperou" || r.key === "obstreperous");
  assert(row && row.count === 2, "repetitionReport counts only prose occurrences");

  // Per-call override: exclude nothing.
  const t5 = checker.analyze("{{zzqx}}", { exclude: null });
  assert(t5.some(i => i.value === "zzqx"), "opts.exclude=null overrides instance exclusion");

  // Function-based ranges.
  const t6 = checker.analyze("zzqx and zzqx", { exclude: (text) => [[0, 4]] });
  assert(t6.filter(i => i.value === "zzqx").length === 1, "function-based ranges honored");

  // No exclusion configured -> unchanged behavior.
  const plain = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_dict_35b",
  });
  assert(plain.analyze("{{zzqx}}").some(i => i.value === "zzqx"), "without exclude option, {{ }} contents are checked");

  console.log(failures ? "\n" + failures + " FAILURES" : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
