// Caps style: characterization, conversion to each style, partial
// application, and the caps rule's departure marks.
// Run: node test/node/caps.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();

async function main() {
  const checker = await sandbox.McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "test_dict_caps",
    exclude: [/\{\{[\s\S]*?\}\}/g],
  });

  H.eq(sandbox.McPhee.capsStyles.map(s => s.id).join(","), "traditional,lcstyle",
    "the style catalog has traditional and lcstyle");

  // --- characterization ---
  const trad = checker.capsReport("The dog sat. The cat ran! Then it rained.");
  H.eq(trad.startCase, "upper", "capital starts read as upper");
  H.eq(trad.gapWidth, "one", "single-space sentence gaps read as one");
  H.ok(trad.consistent, "uniform starts and gaps are consistent");
  H.eq(trad.styles[0].matchPercent, 100, "traditional text matches traditional 100%");
  H.eq(trad.styles[1].matchPercent, 0, "traditional text matches lcstyle 0%");

  const lc = checker.capsReport("the dog sat. the cat ran\nthen it rained");
  H.eq(lc.startCase, "lower", "lowercase starts read as lower");
  H.ok(lc.consistent, "all-lowercase starts are consistent");
  H.eq(lc.styles[1].matchPercent, 100, "lcstyle text matches lcstyle 100%");
  H.eq(lc.starts.lower, 3, "a new line starts a sentence even without end punctuation");

  const mixed = checker.capsReport("The dog sat. the cat ran.  Then it rained. So it goes.");
  H.ok(!mixed.consistent, "mixed starts are not consistent");
  H.eq(mixed.startCase, "mixed", "startCase reports mixed");
  H.eq(mixed.gapWidth, "mixed", "one- and two-space gaps report mixed");
  H.eq(mixed.starts.upper + "/" + mixed.starts.lower, "3/1", "start counts split 3 capital / 1 lowercase");
  H.eq(mixed.gaps.one + "/" + mixed.gaps.two, "2/1", "gap counts split 2 one-space / 1 two-space");
  // traditional: 4 starts + 3 gaps relevant; 1 lowercase start + 1 two-space gap to change.
  H.eq(mixed.styles[0].matchPercent, 71, "traditional match is 5 of 7, floored to 71%");
  // lcstyle has no gap rule: 4 starts relevant, 3 capital starts to change.
  H.eq(mixed.styles[1].matchPercent, 25, "lcstyle match counts starts only: 1 of 4");

  H.eq(checker.capsReport("").startCase, null, "empty text has no deciding starts");
  H.ok(checker.capsReport("").consistent, "empty text is not mixed");
  H.eq(checker.capsReport("").styles[0].matchPercent, null, "empty text has no match percent");

  const neutral = checker.capsReport("I left. NASA called. Jupiter rose. McPhee wrote. iPhone rang.");
  H.eq(neutral.starts.neutral, 5, "I, acronyms, proper nouns, and mixed-case words are neutral");
  H.eq(neutral.startCase, null, "neutral-only starts decide nothing");

  // --- sentence boundaries ---
  const abbrev = checker.capsObservations("We met Mr. Smith, e.g. at noon, and J. Doe too. So do I. we left... and then");
  H.eq(abbrev.starts.map(s => s.value).join(","), "We,So,we",
    "abbreviations, initials, and ellipses are not sentence ends; 'I.' is");

  const lines = checker.capsObservations("- first item\n> quoted line\n12. numbered item\n    code line here\n\"quoted start.\" next one");
  H.eq(lines.starts.map(s => s.value).join(","), "first,quoted,numbered,quoted,next",
    "list markers, quote markers, numbers, and opening quotes are skipped; code lines contribute nothing");

  const excl = checker.capsObservations("Fine here. {{block. inside here}} after. tail");
  H.eq(excl.starts.map(s => s.value).join(","), "Fine,tail",
    "starts and gaps touching an exclusion zone are skipped");

  H.eq(checker.capsObservations("End of line.   \nNext").gaps.length, 0,
    "trailing spaces at a line end are not a sentence gap");

  // --- conversion ---
  const src = "the dog sat.  the cat ran! Jupiter is far. So do I. i think so\nok fine";
  H.eq(checker.convertCaps(src, "traditional").text,
    "The dog sat. The cat ran! Jupiter is far. So do I. I think so\nOk fine",
    "traditional: capital starts, one space after sentence ends, no added punctuation");
  H.eq(checker.convertCaps(src, "lcstyle").text,
    "the dog sat.  the cat ran! Jupiter is far. so do I. i think so\nok fine",
    "lcstyle: lowercase starts, proper nouns and I untouched, gaps untouched");

  const once = checker.convertCaps(src, "traditional").text;
  H.eq(checker.capsChanges(once, "traditional").length, 0, "converting twice changes nothing more");
  H.eq(checker.capsReport(once).styles[0].matchPercent, 100, "after conversion traditional matches 100%");

  const changes = checker.capsChanges(src, "traditional");
  H.eq(changes.map(c => c.kind + ":" + JSON.stringify(c.from) + ">" + JSON.stringify(c.to)).join(" "),
    'start:"the">"The" gap:"  ">" " start:"the">"The" start:"i">"I" start:"ok">"Ok"',
    "the change list is in text order with kinds, from, and to");

  // --- partial application (approve one by one) ---
  const firstOnly = checker.applyCapsChanges(src, [changes[0]]);
  H.eq(firstOnly.slice(0, 13), "The dog sat. ", "applying one change edits only that span");
  H.ok(firstOnly.indexOf("sat.  the") !== -1, "unapproved changes are left alone");
  const skipGap = checker.applyCapsChanges(src, changes.filter(c => c.kind !== "gap"));
  H.ok(skipGap.indexOf("sat.  The") !== -1, "a skipped gap change keeps both spaces while starts change");

  let threw = null;
  try { checker.applyCapsChanges("totally different text", [changes[0]]); } catch (e) { threw = e.message; }
  H.ok(threw && threw.indexOf("expects") !== -1, "a change list from other text throws instead of editing");
  threw = null;
  try { checker.applyCapsChanges(src, [changes[0], changes[0]]); } catch (e) { threw = e.message; }
  H.ok(threw && threw.indexOf("overlapping") !== -1, "overlapping changes throw");
  threw = null;
  try { checker.capsChanges(src, "fancy"); } catch (e) { threw = e.message; }
  H.ok(threw && threw.indexOf("unknown caps style") !== -1, "an unknown style name throws");

  // --- caps rule: departures from the text's majority ---
  const dep = checker.analyze("The dog sat. The cat ran. the bird flew. Then it rained.").filter(i => i.kind === "caps");
  H.eq(dep.length, 1, "one minority start is marked");
  H.eq(dep[0].value + ">" + dep[0].expected, "the>The", "the departure carries the majority form");

  const lcDep = checker.analyze("the dog sat. the cat ran. The bird flew. then it rained.").filter(i => i.kind === "caps");
  H.eq(lcDep.map(i => i.value + ">" + i.expected).join(","), "The>the",
    "in a lowercase-majority text the capital start is the departure");

  H.eq(checker.analyze("The dog sat. the cat ran.").filter(i => i.kind === "caps").length, 0,
    "a tie has no majority and marks nothing");

  const gapDep = checker.analyze("One sat. Two ran. Three flew.  Four hid.").filter(i => i.kind === "caps");
  H.eq(gapDep.length, 1, "the minority gap width is marked");
  H.eq(JSON.stringify(gapDep[0].value) + ">" + JSON.stringify(gapDep[0].expected), '"  ">" "',
    "the gap departure expects the majority width");

  H.eq(checker.analyze("One sat. Two ran. Three flew.   Four hid.").filter(i => i.kind === "caps").length, 0,
    "a 3+ space gap is left to the doublespace rule");

  const strict = checker.analyze("The dog sat. The cat ran. the bird flew.", { profile: "strict" });
  H.eq(strict.filter(i => i.kind === "capitalization").length, 1, "strict still flags the lowercase start");
  H.eq(strict.filter(i => i.kind === "caps").length, 0, "caps does not add a second mark on an already-flagged word");

  const text = "The dog sat. The cat ran. the";
  H.ok(checker.analyze(text).some(i => i.kind === "caps"), "the departure shows when the caret is elsewhere");
  H.ok(!checker.analyze(text, { caret: text.length }).some(i => i.kind === "caps"),
    "the word being typed is not marked as a caps departure");

  H.ok(checker.analyze("The a. The b. the c.", { profile: "casual" }).some(i => i.kind === "caps"),
    "caps is on in the casual profile");
  H.ok(!checker.analyze("The a. The b. the c.", { checkers: { caps: { enabled: false } } }).some(i => i.kind === "caps"),
    "the caps checker can be turned off");

  H.ok(checker.renderHtml("The dog sat. The cat ran. the bird flew.").indexOf('class="mcphee-mark-caps"') !== -1,
    "the overlay renders caps marks");

  H.finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
