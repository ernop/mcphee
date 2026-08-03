// Exclusion zones (options.exclude): excluded spans are invisible to every
// rule, fix, concordance, and repetition count.
// Run: node test/node/exclusions.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();
const COMPONENT_RE = [/\{\{[\s\S]*?\}\}/g]; // double-brace template blocks

async function main() {
  const checker = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    freqUrl: "vendor/wordfreq/en-30k.txt",
    customDictStorageKey: "test_dict_excl",
    exclude: COMPONENT_RE,
  });

  // Misspellings, spaces, and culture words inside {{ }} are invisible.
  const t1 = checker.analyze("a wierd day. {{gallery photso=zzqx   usa japanese}} more prose.");
  H.ok(t1.some(i => i.value === "wierd"), "prose misspelling outside block still flagged");
  H.ok(!t1.some(i => i.value === "photso" || i.value === "zzqx"), "misspellings inside {{ }} invisible");
  H.ok(!t1.some(i => i.kind === "doublespace"), "space run inside {{ }} invisible");
  H.ok(!t1.some(i => i.kind === "culture"), "culture words inside {{ }} invisible");

  // Multiline blocks.
  const t2 = checker.analyze("clean text.\n{{map\n  zoom=12\n  layr=asdfgh\n}}\nclean end.");
  H.ok(t2.length === 0, "multiline {{ }} block fully invisible");

  // Repetition: an excluded occurrence is not an echo partner.
  const t3 = checker.analyze("The leopard slept. {{caption leopard}} It dreamed.");
  H.ok(!t3.some(i => i.kind === "echo"), "excluded word is no echo partner");
  const t4 = checker.analyze("The leopard slept near the leopard.");
  H.ok(t4.some(i => i.kind === "echo"), "echo still fires outside blocks");

  // localFix never touches excluded zones.
  const fix = checker.localFix("teh cat. {{cfg teh   x}} teh end.");
  H.ok(fix.text === "the cat. {{cfg teh   x}} the end.", "localFix fixes prose, leaves {{ }} intact");

  // concordance / repetitionReport skip excluded words.
  const conc = checker.concordance("leopard {{leopard leopard}} leopard", "leopard");
  H.ok(conc.count === 2, "concordance counts only prose occurrences");
  const rep = checker.repetitionReport("obstreperous prose {{obstreperous obstreperous}} text obstreperous");
  const row = rep.rows.find(r => r.key === "obstreperou" || r.key === "obstreperous");
  H.ok(row && row.count === 2, "repetitionReport counts only prose occurrences");

  // Per-call override: exclude nothing.
  const t5 = checker.analyze("{{zzqx}}", { exclude: null });
  H.ok(t5.some(i => i.value === "zzqx"), "opts.exclude=null overrides instance exclusion");

  // Function-based ranges.
  const t6 = checker.analyze("zzqx and zzqx", { exclude: (text) => [[0, 4]] });
  H.ok(t6.filter(i => i.value === "zzqx").length === 1, "function-based ranges honored");

  // No exclusion configured -> unchanged behavior.
  const plain = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_dict_excl_b",
  });
  H.ok(plain.analyze("{{zzqx}}").some(i => i.value === "zzqx"), "without exclude option, {{ }} contents are checked");

  H.finish();
}

main().catch(e => { console.error(e); process.exit(1); });
