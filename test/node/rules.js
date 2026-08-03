// Analysis rules: culture (curated list + dictionary-omission probes),
// ignore list, formality profiles, custom-dictionary precedence, and the
// base misspelling/space rules.
// Run: node test/node/rules.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();

async function main() {
  const McPhee = sandbox.McPhee;
  const checker = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    freqUrl: "vendor/wordfreq/en-30k.txt",
    customDictStorageKey: "test_dict",
  });
  const kinds = (text, opts) => checker.analyze(text, opts).map(i => i.kind + ":" + i.value);

  // --- culture rule (curated list) ---
  const t1 = checker.analyze("the japanese visited usa last year.");
  H.ok(t1.some(i => i.kind === "culture" && i.value === "japanese" && i.expected === "Japanese"), "culture flags 'japanese' -> Japanese");
  H.ok(t1.some(i => i.kind === "culture" && i.value === "usa" && i.expected === "USA"), "culture flags 'usa' -> USA");
  H.ok(!checker.analyze("The Japanese visited the USA.").some(i => i.kind === "culture"), "properly cased forms not flagged");
  H.ok(!checker.analyze("the turkey and china plates were polished.").some(i => i.kind === "culture"), "ambiguous words (turkey/china) excluded");
  H.ok(!checker.analyze("the japanese visited.", { profile: "casual" }).some(i => i.kind === "culture"), "casual profile disables culture");
  H.ok(!checker.analyze("english people dont mind.").some(i => i.kind === "word" && i.value === "english"), "'english' is culture, not unknown-word");

  // --- culture by dictionary omission ---
  // The dictionary rejecting the lowercase form while knowing the cased
  // form IS the proof the word is a proper noun written lowercase.
  const c1 = checker.analyze("jupiter is bright on friday.");
  H.ok(c1.some(i => i.kind === "culture" && i.value === "jupiter" && i.expected === "Jupiter"), "omission probe: jupiter -> Jupiter");
  H.ok(c1.some(i => i.kind === "culture" && i.value === "friday" && i.expected === "Friday"), "omission probe: friday -> Friday");
  H.ok(!c1.some(i => i.kind === "word" && i.value === "jupiter"), "probed word is culture, not blue unknown");
  const c2 = checker.analyze("virginians eat turkey and polish china.");
  H.ok(c2.some(i => i.kind === "culture" && i.value === "virginians" && i.expected === "Virginians"), "omission probe: virginians -> Virginians");
  H.ok(c2.filter(i => i.kind === "culture").length === 1, "turkey/polish/china stay unflagged (lowercase forms are words)");
  const c3 = checker.analyze("that is ok with nasa.");
  H.ok(!c3.some(i => i.kind === "culture" && i.value === "ok"), "ok too short for the ALLCAPS probe");
  H.ok(c3.some(i => i.kind === "culture" && i.value === "nasa" && i.expected === "NASA"), "ALLCAPS probe: nasa -> NASA");
  H.ok(!checker.analyze("jupiter rises.", { profile: "casual" }).some(i => i.kind === "culture"), "casual profile still exempts probed culture");
  checker.ignoreWord("jupiter");
  H.ok(!checker.analyze("jupiter rises.").some(i => i.kind === "culture"), "ignore list silences probed culture");
  checker.unignoreWord("jupiter");

  // --- ignore list ---
  checker.ignoreWord("Helbro");
  H.ok(!checker.analyze("Helbro is here.").some(i => i.value === "Helbro"), "ignored word not flagged");
  H.ok(checker.listIgnoredWords().includes("helbro"), "ignore list stores lowercase");
  checker.unignoreWord("helbro");
  H.ok(checker.analyze("Helbro is here.").some(i => i.value === "Helbro"), "unignored word flagged again");
  checker.ignoreWord("a1"); checker.ignoreWord("b2");
  checker.unignoreAll();
  H.ok(checker.listIgnoredWords().length === 0, "unignoreAll clears the list");

  // --- ignore also silences culture ---
  checker.ignoreWord("japanese");
  H.ok(!checker.analyze("the japanese visited.").some(i => i.kind === "culture"), "ignored word skips culture flag too");
  checker.unignoreWord("japanese");

  // --- formality profiles map ---
  H.ok(sandbox.McPhee.profiles.standard.culture === true, "standard profile includes culture");
  H.ok(sandbox.McPhee.profiles.casual.culture === false, "casual profile excludes culture");
  H.ok(sandbox.McPhee.profiles.strict.sentenceCapitalization === true, "strict includes sentenceCapitalization");

  // --- custom dictionary beats culture ---
  checker.addCustomWord("usa");
  H.ok(!checker.analyze("usa is big.").some(i => i.kind === "culture"), "+dict word exempt from culture");
  checker.removeCustomWord("usa");

  // --- not-rare list: permanent exemption from the repetition detectors ---
  // The frequency list's web corpus lost apostrophes, so contractions like
  // "won't" are unranked and would otherwise count as obscure.
  const rep = "We won't go today. Filler words pad this sentence. We won't go tomorrow either.";
  checker.markNotRare("won't");
  H.ok(!checker.analyze(rep).some(i => i.kind === "obscure" || i.kind === "echo"),
    "not-rare word exempt from obscure and echo");
  H.ok(checker.listNotRareWords().includes("won't"), "not-rare list keeps the word");
  checker.unmarkNotRare("won't");
  H.ok(checker.listNotRareWords().length === 0, "unmarkNotRare removes it");
  // Apostrophe-stripped rank fallback: "won't" resolves through "wont", so
  // even without the list entry a ranked stripped form counts.
  const rank = checker.rankOf("won't");
  H.ok(rank !== null, "rankOf returns a value for contractions");

  // --- base rules still fire ---
  const t2 = kinds("teh cat   sat wierd.");
  H.ok(t2.some(k => k === "word:teh"), "misspelled still flagged");
  H.ok(t2.some(k => k.startsWith("doublespace:")), "triple space still flagged");

  H.finish();
}

main().catch(e => { console.error(e); process.exit(1); });
