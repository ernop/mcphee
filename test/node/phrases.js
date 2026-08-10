// Exact phrasal repetition: exhaustive phrase discovery, maximal grouping,
// exclusions, profiles, dismissal, and full-span rendering.
// Run: node test/node/phrases.js  (from the repo root)
"use strict";
const H = require("./harness");

const sandbox = H.makeSandbox();

async function main() {
  const McPhee = sandbox.McPhee;
  const checker = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    freqUrl: "vendor/wordfreq/en-30k.txt",
    customDictStorageKey: "phrase_test_dict",
  });

  const phraseIssues = (text, opts) => checker.analyze(text, opts)
    .filter(i => i.kind === "echo" && i.phraseWords);

  // Function-word phrases bypass the single-word stopword/frequency gates.
  const basic = "I do not care at all whether this works at all today.";
  const atAll = phraseIssues(basic).filter(i => i.norm === "at all");
  H.eq(atAll.length, 2, "repeated 'at all' flags both occurrences");
  H.ok(atAll.every(i => basic.slice(i.start, i.end) === "at all"),
    "phrase issues span the complete phrase");
  H.ok(atAll.every(i => i.phraseWords === 2),
    "phrase issues report their word count");

  // Discovery is general: this phrase exists nowhere in a curated list.
  const broad = "We crossed under the bridge and waited. They slept under the stars.";
  H.eq(phraseIssues(broad).filter(i => i.norm === "under the").length, 2,
    "arbitrary repeated phrase is discovered");

  // Only the maximal useful phrase is reported, not each nested n-gram.
  const maximal = "We stayed at all costs today. They worked at all costs yesterday.";
  const maximalIssues = phraseIssues(maximal);
  H.eq(maximalIssues.filter(i => i.norm === "at all costs").length, 2,
    "longest shared phrase is reported");
  H.ok(!maximalIssues.some(i => i.norm === "at all"),
    "nested subphrase is not reported separately");

  // Phrase echo is more specific than component-word echo.
  const specific = "The leopard slept soundly. Later the leopard slept quietly.";
  const specificEchoes = checker.analyze(specific).filter(i => i.kind === "echo");
  H.eq(specificEchoes.filter(i => i.norm === "the leopard slept").length, 2,
    "specific phrase flags both full spans");
  H.ok(!specificEchoes.some(i => i.norm === "leopard" || i.norm === "slept"),
    "component words are not duplicated as weaker echo rows");

  // Punctuation ends a phrase; token adjacency alone must not bridge it.
  H.eq(phraseIssues("This matters at, all today but not at all tomorrow.").length, 0,
    "phrase matching never crosses punctuation");

  // The normal echo distance dial also bounds phrase starts.
  checker.echoWindowWords = 3;
  H.eq(phraseIssues("It matters at all one two three four at all today.").length, 0,
    "phrase beyond the echo window is not flagged");
  checker.echoWindowWords = 50;

  H.eq(phraseIssues(basic, { profile: "casual" }).length, 0,
    "casual profile disables phrasal repetition");

  const excluded = "This matters at all. {{The note says at all.}} Nothing repeats.";
  H.eq(phraseIssues(excluded, { exclude: [/\{\{[\s\S]*?\}\}/g] }).length, 0,
    "excluded phrase occurrence is not a repetition partner");

  checker.ignoreRepeat("at all");
  H.eq(phraseIssues(basic).length, 0,
    "session dismissal silences the exact phrase");

  const html = checker.renderHtml(broad);
  H.eq((html.match(/mcphee-mark-echo/g) || []).length, 2,
    "renderer creates one echo mark for each full phrase");
  H.ok(html.includes(">under the</mark>"),
    "rendered mark contains the complete phrase");

  const noFrequencyChecker = await McPhee.create({
    affUrl: "vendor/typo/en_US.aff",
    dicUrl: "vendor/typo/en_US.dic",
    customDictStorageKey: "phrase_test_no_frequency",
  });
  H.eq(noFrequencyChecker.analyze(basic)
      .filter(i => i.kind === "echo" && i.norm === "at all").length, 2,
    "phrase detection does not require a frequency list");

  H.finish();
}

main().catch(e => { console.error(e); process.exit(1); });
