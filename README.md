# McPhee — drop-in textarea spellcheck for any web project

Inspired by John McPhee's editing practice: he ran Kedit's `All` command over
every piece to see each use of a chosen word with the distances between
occurrences — reconsidering any distinctive word that appeared twice, and any
ordinary word that bunched ("Of those which show up more than once, All
expunges all" — his essay "Structure", collected in *Draft No. 4*). This
library's repetition detectors automate that check. No affiliation with or
endorsement by him; the name is an homage. Known as **SpellWell** through
v1.5.0.

**Canonical home: `C:\proj\mcphee` (this repo).** Consumer projects get a
verbatim copy of this folder; `McPhee.version` plus `CHANGELOG.md` tell you
how far behind a copy is. To update a consumer, re-copy the folder (see
"Distribution" below).

Dictionary-based (offline, free, instant) spell highlighting and one-click
local fixes for plain `<textarea>`s. No build step, no framework, no server
component: copy this folder into any project and serve it as static files.

Grown out of two earlier prototypes: the fuseki4_ai article editor (typo-js +
Hunspell en_US + localStorage custom dictionary, sidebar suggestion UI) and
stalin-mode.html (screenshot editor that only had the browser's native
squiggles). McPhee replaces the browser's red squiggles with block
highlights:

| class | meaning | look |
| --- | --- | --- |
| `mcphee-mark-misspelled` | lowercase word not in any dictionary | light pink block |
| `mcphee-mark-unknown` | not in dictionary but shaped like a name/acronym/identifier (Capitalized, ALLCAPS, camelCase) | light blue block |
| `mcphee-mark-doublespace` | an illegitimate extra-space run | ONE joined yellow rectangle, grey outline, no internal divisions. Never flagged: exactly two spaces after sentence-ending punctuation (deliberate sentence separator) and line-leading indentation (Markdown code blocks) |
| `mcphee-mark-capitalization` | lowercase sentence-start dictionary word (strict profile) | light orange block |
| `mcphee-mark-punctuation` | text ends without terminal punctuation (strict profile) | orange-outlined box on the last character |
| `mcphee-mark-echo` | the same content word reused within 50 words (both occurrences) | light lavender block |
| `mcphee-mark-obscure` | a rare word (outside the top 10,000 by frequency) used 2+ times in the text | light green block |
| `mcphee-mark-culture` | a nation/group/language/religion name written lowercase ("japanese", "usa") | gentle teal block |

## Files

- `mcphee.js` — the module (global `McPhee`, plain script, no build)
- `mcphee.css` — overlay + mark + panel styles
- `vendor/typo/typo.min.js` — [typo-js 1.2.1](https://github.com/cfinke/Typo.js) (Hunspell reader, Modified BSD)
- `vendor/typo/en_US.aff`, `vendor/typo/en_US.dic` — Hunspell en_US dictionary
- `vendor/wordfreq/en-30k.txt` — top 30,000 English words by frequency (one
  per line, most common first), from [Peter Norvig's Google Web Trillion Word
  Corpus counts](https://norvig.com/ngrams/); powers the repetition detectors
- `demo.html` — feature exercise page (open via any static server)
- `DESIGN.md` — cross-project architecture: config layering, dictionary sync,
  form gating, Firefox extension design
- `extension/` — **McPhee Guard**, the Firefox extension: teach it (two
  clicks) which submit buttons must refuse misspelled text — built for sites
  where a typo can't be fixed after posting (x.com). Per-browser guards and
  dictionary. See `extension/README.md` for build/load/teach instructions

## Usage

```html
<link rel="stylesheet" href="mcphee/mcphee.css">
<script src="mcphee/vendor/typo/typo.min.js"></script>
<script src="mcphee/mcphee.js"></script>
```

```js
const sw = await McPhee.create({
  affUrl: "mcphee/vendor/typo/en_US.aff",
  dicUrl: "mcphee/vendor/typo/en_US.dic",
  freqUrl: "mcphee/vendor/wordfreq/en-30k.txt", // optional; repetition detectors
  extraWords: ["recraft", "grok"],          // project jargon, never flagged
  customDictStorageKey: "myapp_mcphee",  // per-user dictionary (localStorage)
  profile: "standard",                      // default rule profile
  // Repetition-detector tuning (defaults shown):
  // echoWindowWords: 50, echoCommonRank: 2000, obscureRank: 10000,
});

// Batteries-included: overlay + panel + placement in one call. The panel
// either docks inline beside the textarea (~30% of the row, sticky) or
// slides in from the screen edge as a drawer; a chrome button switches
// modes live and the choice persists in localStorage — per origin, so
// every hostname/browser pair remembers its own preference:
const d = sw.dock(document.querySelector("textarea"), {
  // mode: "inline" | "drawer"   (default: stored preference, else inline)
  // panelFraction: 0.3,          inline width share
  // modeStorageKey: "mcphee_panel_mode",
  // handle: true,                drawer-mode floating "✓ spelling" opener
});
d.controller;      // overlay controller (below)
d.panel;           // panel controller
d.setMode("drawer"); d.openDrawer(); d.toggleDrawer();
d.detach();

// ...or wire the pieces yourself:
// Live highlighting behind a textarea (native typing/selection untouched):
const ctl = sw.attach(document.querySelector("textarea"));
ctl.refresh();            // after programmatic .value writes (also auto-polled)
ctl.refresh(true);        // force full regeneration: styles re-mirrored,
                          // geometry re-synced, marks rebuilt (the panel's
                          // "↻ recheck" button calls this)
ctl.scrollToOffset(120);  // scroll the textarea to a character offset
ctl.setRules({ profile: "casual" });  // switch rule profile live
ctl.setEnabled(false);    // toggle off (restores native browser spellcheck)
ctl.detach();

// Live issues panel: suggestion buttons (replace-all, undo-preserving),
// add-to-dictionary, ignore (persistent per-word mute with a 3s undo chip
// and an "ignored (N)" manager), capitalize, collapse extra spaces.
// Hovering a row scrolls the textarea to the issue and pulses EVERY
// occurrence for exactly as long as the pointer stays; clicking anywhere on
// the row selects the issue's text (same as its `select` button). The
// header's "↻ recheck" button force-regenerates the overlay and the panel.
// A formality chooser (casual/normal/formal -> the three profiles) is
// always visible, persisted per origin; its ⚙ config opens per-rule
// checkboxes and the repetition knobs, also persisted per origin.
// With a controller the panel stays linked to the text both ways: rows
// whose occurrences are all scrolled off screen dim (followViewport), and
// the row nearest the caret is highlighted and scrolled into view in the
// panel (followCaret) — both default on, pass false to disable:
const panel = sw.attachPanel({
  textarea, container: sidebarDiv, controller: ctl,
  // formalityStorageKey: "mcphee_formality",
  // ruleOverridesStorageKey: "mcphee_rule_overrides",
});
panel.setFormality("strict"); panel.getFormality();

// Persistent per-word mute (what the panel's ignore buttons call):
sw.ignoreWord("Helbro"); sw.unignoreWord("Helbro");
sw.listIgnoredWords(); sw.unignoreAll();

// One-click local fix, applied through the browser's editing pipeline so
// Ctrl+Z still works (one undo step):
const fix = sw.applyFixes(textarea);
console.log(fix.wordChanges, fix.spaceRuns, fix.applied);

// ...or compute without touching the DOM:
const fix2 = sw.localFix(textarea.value);

// Form gating — refuse to submit text with spelling errors:
const guard = sw.guardForm(form, {
  blockOn: ["misspelled"],  // blue unknowns don't block by default
  watch: true,              // live-disable submit buttons ("insists" mode)
  // A guard is a hard block: fix the words or add them to the dictionary.
});

// Analysis without UI, e.g. for a lint pass:
sw.analyze("teh  Quick brown fox"); // [{kind:"word",value:"teh",...}, {kind:"doublespace",...}]
sw.analyze("no cap", { profile: "strict" }); // adds capitalization/punctuation issues

// Personal dictionary:
sw.addCustomWord("fuseki");
sw.removeCustomWord("fuseki");
sw.listCustomWords();
sw.importWords(oldWordArray);  // union-merge (migration / future remote sync)

// Repetition detectors (issue kinds "echo" and "obscure"):
sw.analyze("The leopard slept. Later the leopard woke.");
// -> two {kind:"echo", norm:"leopard", distance:4} issues (both occurrences)
sw.ignoreRepeat("leopard");    // session-scoped "this repetition is deliberate"

// Kedit-All primitives for concordance / deep-look UIs:
sw.concordance(text, "but");   // every occurrence + word-gaps between them
sw.repetitionReport(text);     // all repeated words ranked by bunching
                               // surprise; rare-word repeats pinned on top
```

## Repetition detectors (the McPhee rules)

After John McPhee's two uses of Kedit's `All` command (*Draft No. 4*,
"Structure"): a distinctive word ordinarily earns ONE appearance per piece,
and the gaps between repeats of ordinary words expose accidental bunching.
(Peter Matthiessen, who feared the same failure — "you often do plagiarize
yourself" — did it by hand.) Two style detectors, both highlight-only (word
choice is the author's call — there is no autofix):

- **echo** — the same content word reappears within `echoWindowWords` words
  (default 50). Comparison is case-insensitive, possessive-stripped, and
  plural-folded (`leopard` / `Leopard's` / `leopards` all match). Both
  occurrences are marked lavender. Function words never fire; with a
  frequency list loaded, words ranked more common than `echoCommonRank`
  (default 2000) are also exempt.
- **obscureRepeat** — a word rarer than `obscureRank` (default 10000 in the
  frequency list, or missing from it entirely) used two or more times
  anywhere in the text. All occurrences are marked light green. Requires
  `freqUrl`; without it the rule is inert.

Exemptions, in both detectors: words shorter than 4 letters, stopwords,
`extraWords`, and personal-dictionary words — an article *about* fuseki gets
to say "fuseki" as often as it likes, so adding a word to the dictionary is
the permanent repetition opt-out. The panel's `dismiss` button
(`sw.ignoreRepeat(word)`) is the session-scoped one.

## Rule catalog — exact parameters

Every rule, precisely what fires it, and what exempts it:

- **misspelled** (pink) — a word matching `[A-Za-z]+(?:['’][A-Za-z]+)*`,
  entirely lowercase, ≥2 letters, not in the Hunspell dictionary, whose
  Capitalized form is also not in the dictionary. Exempt: personal
  dictionary, `extraWords`, ignore list.
- **unknown** (blue) — a word the dictionary doesn't know that is shaped
  like a name/acronym/identifier (contains any uppercase), OR a lowercase
  word whose Capitalized form IS in the dictionary (a casually-lowercased
  proper noun — never "corrected" to an unrelated word). Same exemptions.
- **doublespace** (yellow) — a run of 2+ spaces that is neither
  line-leading indentation nor exactly two spaces after sentence-ending
  punctuation `.` `!` `?` `…` (closing quotes/brackets allowed between).
  Sentence separators grown to 3+ spaces collapse back to two, everything
  else to one.
- **culture** (teal) — a word from the nation/group/language/religion list
  written entirely lowercase ("japanese", "usa", "english"); the fix is the
  properly-cased form (Japanese, USA). The default list is conservative:
  words whose lowercase form is a common English word (turkey, china,
  polish, black as a color...) are excluded to avoid false positives — add
  per-project entries via `options.cultureWords` (e.g. "black" for writing
  where the ethnonym reading dominates). Exempt: personal dictionary,
  `extraWords`, ignore list.
- **sentenceCapitalization** (orange) — a lowercase dictionary word at a
  sentence start (after `.` `!` `?` `…` + whitespace, or text start).
- **terminalPunctuation** (orange outline) — the text's last
  non-whitespace character is not sentence-ending punctuation or a closer.
- **echo** (lavender) — the same content word (case-insensitive,
  possessive-stripped, plural-folded) reappears within `echoWindowWords`
  words (default 50). Exempt: words under 4 letters, stopwords, words
  ranked more common than `echoCommonRank` (default 2000), dictionary and
  extra words, session dismissals.
- **obscureRepeat** (green) — a word rarer than `obscureRank` (default
  10000) or absent from the frequency list, used 2+ times anywhere. Same
  exemptions; inert without `freqUrl`.

## Formality levels (rule profiles)

The panel shows these as the always-visible chooser casual / normal /
formal; the selected level persists per origin.

| profile (chooser label) | misspelled | unknown | doublespace | culture | sentenceCapitalization | terminalPunctuation | echo | obscureRepeat |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `standard` ("normal") | on | on | on | on | off | off | on | on |
| `strict` ("formal") | on | on | on | on | on | on | on | on |
| `casual` ("casual") | on | off | on | off | off | off | off | off |

`casual` is the "japanese" mode: lowercase proper nouns, lowercase i, and
unpunctuated prose are intentional, so only genuine non-words and double
spaces are flagged. `strict` is the full rigamarole: complete sentences,
capitalized sentence starts, terminal punctuation.

Every entry point (`create`, `attach`, `attachPanel`, `analyze`, `localFix`,
`applyFixes`, `guardForm`) accepts `{ profile }` and/or per-rule `{ rules }`
overrides; rules win over the profile, the profile wins over the instance
default. The panel's ⚙ config writes per-origin overrides on top of the
chosen profile (localStorage `mcphee_rule_overrides`). Word lists
(extraWords, personal dictionary, ignore list) apply regardless of profile —
that layering follows cSpell's model (word lists union; settings override).

## Design notes

- The overlay is a mirrored backdrop `div` rendered *behind* the textarea
  (transparent text, colored mark backgrounds, textarea background made
  transparent). Geometry mirrors the textarea's client box so a vertical
  scrollbar can't skew wrapping.
- **Overlay correctness is enforced, not assumed**: after every render the
  controller checks that the backdrop's text equals the textarea's value
  and that both boxes wrapped identically (equal scrollHeights). A failed
  check triggers one automatic re-mirror + re-render; if it still fails the
  overlay hides itself rather than display misplaced highlights, and keeps
  retrying in the background until it verifies. Full analysis in DESIGN.md
  ("Overlay correctness").
- Classification is deliberately heuristic and predictable, not clever:
  anything capitalized/ALLCAPS/camelCase that the dictionary doesn't know is
  "unknown" (blue), on the theory that names and jargon shouldn't nag. A
  lowercase word whose Capitalized form is in the dictionary (english,
  virginians) is also blue, never auto-"fixed" to an unrelated word
  (english→anguish would be vandalism). The cost: a sentence-initial
  capitalized typo reads blue, not pink.
- `localFix` is precision-first because a wrong "fix" is worse than a
  highlight: a small built-in common-typos map wins outright (typo-js ranks
  classics like "teh" badly — its suggestions don't even include "the");
  otherwise the minimum edit-distance suggestion is applied only when it is
  unique, is the only adjacent-transposition candidate, or strictly wins a
  shared prefix+suffix tie-break. Blue words are never touched; anything
  ambiguous stays highlighted. Extend the map per project via
  `options.autofixMap`. Missing terminal punctuation is never auto-fixed
  (. vs ? vs ! is a guess).
- Space-run policy: the author double-spaces after sentence-ending
  punctuation on purpose, so exactly two spaces after `.` `!` `?` `…`
  (closing quotes/brackets allowed in between) are legitimate and unmarked.
  Line-leading runs are indentation and also legitimate. Everything else is a
  violation shown as one joined rectangle; fixes collapse a sentence
  separator that grew to 3+ spaces back to two, and any other run to one.
- All programmatic edits (`applyFixes`, panel buttons) go through
  `execCommand("insertText")` with a `setRangeText` fallback, so the
  textarea's native undo stack survives. Direct `.value` assignment (the
  original fuseki prototype) wipes it.
- en_US.dic is ~700 KB and en-30k.txt ~250 KB; `McPhee.create` fetches and
  parses them once per page. Load lazily if startup matters. A failed
  frequency-list fetch degrades gracefully (echo falls back to the stopword
  list alone, obscureRepeat goes inert) instead of killing the checker.

## Distribution

Copy-the-folder, on purpose: consumers must never break because this repo
changed. To update a consumer project:

```powershell
Copy-Item -Recurse -Force C:\proj\mcphee\* <consumer>\mcphee\
# then delete demo.html / DESIGN.md / CHANGELOG.md from the copy if unwanted
```

Known consumers:

- `C:\proj\multiImageClient\MultiImageClient\Ui\wwwroot\spellwell\` (v1.0.0,
  still under the old SpellWell name)
- `C:\proj\fuseki4_ai\static\mcphee\` (v3.4.0, deployed to fuseki.net 2026-08-02)
