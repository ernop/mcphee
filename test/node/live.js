// In-progress-word suppression (opts.caret) and Control-tap backward fix.
// Caret cases use caret notation: "|" marks the caret.
// Run: node test/node/live.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();

function checkBackward(checker, before, want, label) {
  const o = H.fromNotation(before);
  const ta = H.fakeTextarea(o.text, o.caret);
  const result = checker.applyNearestBackwardFix(ta);
  H.eq(H.toNotation(ta.value, ta.selectionStart), want, label);
  return result;
}

async function main() {
  const checker = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_dict_live",
  });

  const text = "teh cat sat here";
  H.ok(checker.analyze(text).some(i => i.value === "teh"),
    "teh is misspelled when no caret is passed");
  H.ok(!checker.analyze(text, { caret: 3 }).some(i => i.value === "teh"),
    "teh is not shown as misspelled while the caret is at its end");
  H.ok(!checker.analyze(text, { caret: 1 }).some(i => i.value === "teh"),
    "teh is not shown as misspelled while the caret is inside it");
  H.ok(checker.analyze(text, { caret: 4 }).some(i => i.value === "teh"),
    "teh is shown once the caret has left it (space after the word)");
  H.ok(checker.analyze(text, { caret: text.length }).some(i => i.value === "teh"),
    "teh is shown when the caret is later in the text");

  const two = "teh cat teh";
  const atSecond = checker.analyze(two, { caret: two.length });
  H.ok(atSecond.filter(i => i.value === "teh").length === 1,
    "only the in-progress teh is hidden; the earlier one still flags");
  H.ok(atSecond.some(i => i.value === "teh" && i.start === 0),
    "the remaining teh is the earlier occurrence");

  H.ok(!checker.analyze("teh", { caret: 3 }).some(i => i.classification === "misspelled"),
    "a lone in-progress misspelling produces no spelling issue");

  const htmlShown = checker.renderHtml("teh cat");
  H.ok(htmlShown.indexOf("mcphee-mark-misspelled") !== -1,
    "overlay marks teh when the caret is not in it");
  const htmlHidden = checker.renderHtml("teh cat", { caret: 3 });
  H.ok(htmlHidden.indexOf("mcphee-mark-misspelled") === -1,
    "overlay does not mark teh while the caret is in it");
  H.ok(htmlHidden.indexOf("teh cat") !== -1 || htmlHidden.indexOf("teh") !== -1,
    "hiding the mark does not remove the characters (content parity)");

  H.eq(checker.pickRegionFix("i", "fi"), "if I",
    "i fi region-rewrites to if I");
  H.eq(checker.pickRegionFix("the", "teh"), null,
    "the teh is not a space-slip; teh stays a single-word typo");

  const region = checker.analyze("i fi").find(i => i.value === "fi");
  H.ok(region && region.classification === "misspelled",
    "fi is a misspelling (not a word)");
  H.ok(region.regionFix && region.regionFix.to === "if I",
    "fi after i carries a local-region fix to if I");
  H.eq(region.regionFix.start, 0, "region span starts at the previous word");

  const rFi = checkBackward(checker,
    "i fi|",
    "if I|",
    "Control-tap cleans up the local region around fi, not fi alone");
  H.ok(rFi.applied && rFi.to === "if I", "Control-tap reports if I");
  const oCaret = H.fromNotation("i fi|");
  const taCaret = H.fakeTextarea(oCaret.text, oCaret.caret);
  checker.applyNearestBackwardFix(taCaret, { caret: oCaret.caret });
  H.eq(H.toNotation(taCaret.value, taCaret.selectionStart), "if I|",
    "Control-tap still rewrites i fi when analyze opts carry a caret");

  const local = checker.localFix("i fi and teh cat");
  H.ok(local.text.indexOf("if I") !== -1, "localFix rewrites i fi to if I");
  H.ok(local.text.indexOf("the cat") !== -1, "localFix still fixes teh as a word");
  H.ok(local.text.indexOf("i fi") === -1, "localFix does not leave i fi");
  H.eq(checker.guessCorrection("wierd"), "weird", "transposition wierd -> weird");

  const r1 = checkBackward(checker,
    "The dog sat. teh cat ran|",
    "The dog sat. the cat ran|",
    "Control-tap fixes the nearest misspelling behind the caret");
  H.ok(r1.applied && r1.from === "teh" && r1.to === "the",
    "backward fix reports the change it made");

  checkBackward(checker,
    "teh| cat ran",
    "the| cat ran",
    "Control-tap fixes the in-progress word at the caret");

  const first = checkBackward(checker,
    "teh cat sat. wierd|",
    "teh cat sat. weird|",
    "nearest behind the caret is the later misspelling, not the earlier one");
  H.ok(first.applied && first.from === "wierd", "first tap took wierd");

  const ta = H.fakeTextarea("teh cat sat. weird", "teh cat sat. weird".length);
  const again = checker.applyNearestBackwardFix(ta);
  H.ok(again.applied && again.from === "teh",
    "a subsequent backward fix walks to the earlier misspelling");
  H.eq(ta.value, "the cat sat. weird", "second fix rewrote only teh");

  const clean = checkBackward(checker,
    "All clean here.|",
    "All clean here.|",
    "Control-tap on clean text changes nothing");
  H.ok(!clean.applied, "clean text reports applied: false");

  const ahead = checkBackward(checker,
    "the |cat teh",
    "the |cat teh",
    "misspellings after the caret are not candidates");
  H.ok(!ahead.applied, "forward misspellings are ignored");

  H.finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
