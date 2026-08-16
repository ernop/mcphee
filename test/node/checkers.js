// Checker optionsets: enable, order, params; two dictionaries; { rules }
// still works. Run: node test/node/checkers.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();

function ids(list) { return list.map(c => c.id); }
function enabledIds(list) { return list.filter(c => c.enabled).map(c => c.id); }
function misspelled(issues) {
  return issues.filter(i => i.kind === "word" && i.classification === "misspelled").map(i => i.value);
}

async function main() {
  const McPhee = sandbox.McPhee;
  H.ok(Array.isArray(McPhee.checkers) && McPhee.checkers.some(c => c.id === "spell"),
    "McPhee.checkers lists the catalog");

  const oldOnly = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_checkers_old",
  });

  H.ok(!ids(oldOnly.availableCheckers()).includes("spell2026"),
    "2026 checker is omitted when that dictionary was not loaded");
  H.ok(enabledIds(oldOnly.resolveCheckers()).includes("spell"),
    "old-dict-only default enables the original spell checker");
  H.ok(oldOnly.resolveRules().misspelled === true, "old-dict-only default keeps misspelled on");
  H.ok(misspelled(oldOnly.analyze("teh cat sat.")).includes("teh"),
    "old-dict-only still flags teh");
  H.ok(!misspelled(oldOnly.analyze("amongst friends.")).includes("amongst"),
    "old-dict-only accepts a word only it knows");
  H.ok(misspelled(oldOnly.analyze("online now.")).includes("online"),
    "old-dict-only flags a word only the 2026 dictionary knows");

  H.ok(oldOnly.resolveRules({ rules: { misspelled: false } }).misspelled === false,
    "{ rules: { misspelled: false } } still disables spelling");
  H.ok(misspelled(oldOnly.analyze("teh cat.", { rules: { misspelled: false } })).length === 0,
    "{ rules } still suppresses misspelling issues");
  H.ok(oldOnly.resolveCheckers({ checkers: { spell: { enabled: false } } })
    .find(c => c.id === "spell").enabled === false,
    "per-checker enabled:false turns that checker off");
  H.eq(oldOnly.resolveCheckers({ checkers: { echo: { order: 0 } } })
    .find(c => c.id === "echo").order, 0,
    "per-checker order is honored");
  H.eq(oldOnly.sectionRank({ checkers: { echo: { order: 0 } } }).echo, 0,
    "sectionRank follows checker order");
  H.eq(oldOnly.resolveCheckers({ checkers: { echo: { params: { echoWindowWords: 7 } } } })
    .find(c => c.id === "echo").params.echoWindowWords, 7,
    "per-checker params are honored");

  // Per-call params act on that run only and never leak onto the instance.
  const echoText = "An obstreperous crowd of filler words met an obstreperous mood.";
  H.ok(oldOnly.analyze(echoText).some(i => i.kind === "echo"),
    "nearby rare-word reuse is an echo at the default window");
  H.ok(!oldOnly.analyze(echoText, { checkers: { echo: { params: { echoWindowWords: 2 } } } })
    .some(i => i.kind === "echo"),
    "a per-call echo window narrows that analysis");
  H.eq(oldOnly.echoWindowWords, 50,
    "the per-call param did not change the instance default");
  H.ok(oldOnly.analyze(echoText).some(i => i.kind === "echo"),
    "the next default analysis is unaffected");

  const baked = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_checkers_baked",
    rules: { unknown: false },
  });
  H.ok(baked.resolveRules().unknown === false,
    "constructor { rules } bake as instance defaults");
  H.ok(baked.resolveRules({ profile: "standard" }).unknown === true,
    "an explicit profile drops constructor rule overrides");

  const both = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    affUrl2026: "vendor/typo/en_US_2026.aff",
    dicUrl2026: "vendor/typo/en_US_2026.dic",
    customDictStorageKey: "test_checkers_both",
  });

  H.ok(ids(both.availableCheckers()).includes("spell2026"),
    "2026 checker is available when that dictionary is loaded");
  const def = both.resolveCheckers();
  H.ok(def.find(c => c.id === "spell2026").enabled === true, "default with 2026: 2026 spell on");
  H.ok(def.find(c => c.id === "spell").enabled === false, "default with 2026: old spell off");
  H.ok(def.find(c => c.id === "sentenceCapitalization").enabled === false,
    "standard profile still leaves sentence capitalization off");
  H.ok(def.find(c => c.id === "terminalPunctuation").enabled === false,
    "standard profile still leaves terminal punctuation off");

  H.ok(!misspelled(both.analyze("online now.")).includes("online"),
    "2026-default accepts a word the 2026 dictionary knows");
  H.ok(misspelled(both.analyze("amongst friends.")).includes("amongst"),
    "2026-default flags a word only the old dictionary knows");
  H.ok(misspelled(both.analyze("pathologize this.")).includes("pathologize"),
    "a word in neither dictionary is still a misspelling");
  H.ok(!misspelled(both.analyze("the cat sat.")).includes("the"),
    "a word in both dictionaries is accepted");

  const union = { checkers: { spell: { enabled: true }, spell2026: { enabled: true } } };
  H.ok(!misspelled(both.analyze("online amongst friends.", union)).includes("online"),
    "both spell checkers on: a word either dictionary knows is accepted");
  H.ok(!misspelled(both.analyze("online amongst friends.", union)).includes("amongst"),
    "both spell checkers on: the other dictionary's word is accepted too");
  H.ok(misspelled(both.analyze("pathologize this.", union)).includes("pathologize"),
    "both spell checkers on: a word neither knows is still flagged");

  H.ok(both.resolveRules({ checkers: { spell2026: { enabled: false } } }).misspelled === false,
    "turning off the only enabled spell checker turns misspelled off");

  // rules.misspelled means "spelling on/off", never "every dictionary on":
  // an explicit true keeps the default dictionary choice.
  H.ok(both.resolveCheckers({ rules: { misspelled: true } })
    .find(c => c.id === "spell").enabled === false,
    "rules.misspelled:true does not re-enable the old dictionary");
  H.ok(misspelled(both.analyze("amongst friends.", { rules: { misspelled: true } })).includes("amongst"),
    "rules.misspelled:true keeps the 2026-only acceptance set");
  H.ok(misspelled(both.analyze("online amongst.", { rules: { misspelled: false } })).length === 0,
    "rules.misspelled:false disables every spell checker");

  H.finish();
}

main().catch(e => { console.error(e); process.exit(1); });
