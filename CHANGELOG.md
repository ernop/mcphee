# McPhee changelog

## 3.10.0 — 2026-08-13

The word currently being typed is not shown as misspelled; a Control tap
applies a naive guess to the nearest misspelling behind the caret; first
suggestion buttons share a vertical line; local space-slips such as
"i fi" become "if I".

- While the caret is inside a word (or at either edge of it), that word is
  not marked misspelled, unknown, culture, or capitalization — overlay and
  panel. Form guards still see it. The mark returns once the caret leaves
  the word.
- Tapping Control with no other key replaces the nearest misspelling at or
  behind the caret with the best guess (confident pick, else the top
  Hunspell suggestion). One occurrence, undo-preserving, so Ctrl+Z reverts
  it; the next Control tap walks to the previous misspelling. Other Control
  chords are unchanged.
- The first suggestion (or cased-fix) button of every spelling row in the
  panel aligns on one vertical line.
- A misspelling immediately after a real word, separated by one space, is
  also tried as a local slip: the pair is rewritten if there is exactly one
  dictionary-word reading one edit away (join, or a different place to put
  the space). "i fi" becomes "if I" — "fi" is not a word, and guessing
  "fi"→"if" would leave "i if". Standalone "i" in that rewrite is the
  pronoun and is capitalized.

## 3.9.1 — 2026-08-11

Three overlay-correctness fixes, found while diagnosing visibly misplaced
highlights that appeared during typing (observed in Firefox in a host app).

- The backdrop was sized from `clientWidth`, which is integer-rounded,
  while the textarea wraps its text against its true fractional width. The
  up-to-half-pixel difference could wrap a line one word differently than
  the textarea; when the flipped wrap point kept the total line count
  unchanged, wrap parity could not detect it, and every mark below the
  divergence displayed shifted by one word. The backdrop is now sized at
  full precision: the fractional part of the client width is recovered
  from the client rect and combined with `clientWidth`'s integer part
  (including the exact half-pixel tie, where browsers round up).
- The wrap-parity invariant compared raw scrollHeights, which clamp to the
  element's own box — so while the text fit inside the visible textarea
  (the most common state), the check was vacuous and would have accepted
  any wrap divergence, even a wrong font after a late style change. Both
  content heights are now measured for real (momentary `height: 0`, one
  layout pass, no paint), so wrap parity holds meaning at every text
  length.
- A state audit (prompted by the creator asking whether the recorded state
  of play could drift from the buffer's real contents) found that
  `lastRendered` was assigned before the render: an analyzer exception
  mid-keystroke would leave stale marks visible AND believed-current, so
  even the background poll never repaired them. A render that does not
  complete is now an integrity failure like any other — the overlay hides
  and the poll retries until a full render verifies. The integrity check
  also now compares the display against the textarea's live value, never
  against the variable recording what we think we rendered.
- The browser suite gains a wrap-point matrix at fractional widths in a
  proportional font, plus an aimed case that plants a word boundary inside
  the clientWidth rounding gap by measurement (with a canary asserting the
  old sizing diverges there, so the case cannot silently go dull). Wrap
  points are compared against an exact-width reference mirror, since the
  integrity self-check is blind to same-line-count divergence by
  construction.

Echo detection now covers complete repeated phrases, not only individual
content words.

- Any exact sequence of two or more dictionary-known words repeated within
  `echoWindowWords` is found automatically; there is no curated phrase list.
  Function-word phrases such as "at all" therefore participate even though
  their individual words remain exempt from single-word echo.
- Matching is case/apostrophe-insensitive and bounded by punctuation,
  exclusion zones, misspellings, and other active issues. Competing nested
  matches collapse to the phrase that explains the most repeated text, so a
  repeated four-word phrase produces one row rather than overlapping bigram,
  trigram, and four-word rows.
- Every full occurrence receives the existing lavender echo mark and one
  grouped panel row; hover highlights all phrase spans together. Dismissal is
  session-scoped to the exact phrase and also suppresses the weaker
  component-word echoes it replaced.

## 3.8.2 — 2026-08-03

- Fixes invisible highlights introduced in 3.7.0: the geometry reset on
  `.mcphee-backdrop mark` included `background: transparent`, and that
  selector (class + element) outweighs the single-class category rules —
  every mark rendered colorless while classes, geometry, and integrity all
  passed. The reset no longer touches background. The browser suite now
  asserts actual paint: every mark's computed background is non-transparent
  and the hover highlight computes to the exact amber.

## 3.8.1 — 2026-08-03

- Contractions (won't, don't, they're, could've, ...) join the stopword
  set as their own closed class, so they can never be flagged as rare or
  echoed regardless of frequency-list gaps. This is the structural fix for
  the list's missing-apostrophes problem; the not-rare list remains for
  everything else, and the apostrophe-stripped rank fallback stays.

## 3.8.0 — 2026-08-03

Hover highlighting is now a solid color change, and frequency-list gaps get
a permanent correction.

- Hovering a panel row solidly recolors every occurrence of the issue —
  full-word background swap, amber, applied the instant the pointer enters
  and removed the instant it leaves. No pulsing, no animation, no
  transitions, anywhere. Repeat rows (echo, obscure) recolor both/all uses
  at once, so the two occurrences under discussion are always visible
  together. Controller API: `hoverStart(starts)` / `hoverStop()` replace
  `pulseStart` / `pulseStop`.
- "not rare": obscure-repeat rows carry a persistent button that marks the
  word as not actually rare — the correction for gaps in the vendored
  frequency list (its web corpus lost apostrophes, so contractions like
  "won't" are unranked and counted as obscure). Marked words rank as
  maximally common: never obscure, exempt from echo, in every text, stored
  per browser. Checker API: `markNotRare`, `unmarkNotRare`,
  `listNotRareWords`.
- Rank lookups for contractions fall back to the apostrophe-stripped form
  (won't → wont) before counting a word as unranked.

## 3.7.0 — 2026-08-03

Fixes the disappearing highlights, separates the repetition sections, and
rebuilds the test setup.

- **Host-page `mark` styling no longer kills the overlay.** CSS frameworks
  (Bootstrap's reboot among them) pad `mark` elements; with hundreds of
  marks the padding compounded into extra line-wraps in the backdrop, the
  wrap-parity integrity check failed, and the overlay correctly hid itself —
  leaving no highlights and no hover pulse while the panel kept listing
  issues. Backdrop marks now carry a full geometry reset (padding, margin,
  border, font, spacing) so a mark occupies exactly its text.
- Echo (lavender) and obscure repeat (green) are separate panel sections;
  they previously shared one section and interleaved by document position.
- Suggestions are skipped for words longer than 24 characters: Hunspell
  suggestion cost explodes with length, and a pasted long token could
  freeze the panel for minutes. No real word loses anything.
- Tests reorganized by area. `test/node/` holds the analysis suites (rules,
  exclusions, caret) on a shared harness, with caret tests rewritten in
  caret notation ("|" marks the caret in plain strings — no offset
  arithmetic). `test/browser/suite.py` is a Playwright suite covering
  overlay visibility, integrity across a content matrix (including
  host-page mark styling), hover pulse, panel section order, and suggestion
  acceptance, using the overlay's own integrity self-check as the oracle.
  `npm test` runs the Node layer.

## 3.6.2 — 2026-08-02

Accepting a suggestion now drops you to the next item instead of losing
your place. Previously a panel action rewrote the whole text (leaving the
caret at the end of the document) and rebuilt the panel (clamping its
scroll to the top), so caret-follow could then yank the panel to its last
row.

- Whole-text panel edits (suggestion buttons, culture fixes, collapse
  spaces) restore the caret to where it was, adjusted for the length
  changes of replacements before it; a caret inside a replaced word lands
  at the replacement's end. Still one undo step.
- The panel re-render preserves the scroll position of whatever element
  scrolls it (container, dock side column, or drawer), so the acted-on
  row's neighbors stay in place and the next row moves up into its spot.
- `applyFixes` likewise re-anchors the caret through the rewrite (common
  prefix/suffix mapping) instead of leaving it at the end.

## 3.6.1 — 2026-08-02

Documentation restructure; no behavior changes.

- `AGENTS.md` is the master index: every doc is linked through it, and it
  records the project's standing rules (public-text approval, product-only
  README, no private information in public text) and the product decision
  log (`docs/product-decisions.md`).
- `README.md` rewritten as product-only. All technical material (files,
  setup, API, rule catalog, profiles, design notes, distribution) moved to
  `docs/integration.md`.
- References to pre-release history and internal project details removed
  from all documentation and code comments.

## 3.6.0 — 2026-08-02

- Culture by dictionary omission: a lowercase word the dictionary rejects
  whose Capitalized form it knows (jupiter/Jupiter, friday/Friday,
  virginians/Virginians) is provably a proper noun written lowercase — it
  now surfaces as a teal culture issue with the one-click cased fix instead
  of a vague blue unknown. A second probe catches ALLCAPS forms
  (nasa → NASA; length >= 3 so "ok" is left alone). Both probes are
  conservative by construction: turkey, china, polish, and black never fire
  because their lowercase forms are ordinary dictionary words. The curated
  nation/group/language list remains as a backstop for names the Hunspell
  dictionary lacks, and `cultureWords` still adds per-project entries. Zero
  extra dictionary lookups for the Capitalized probe — classify() had
  already performed it.

## 3.5.0 — 2026-08-02

- Exclusion zones: `options.exclude` — an array of global RegExps (each
  match is a zone) or a function `(text) -> [[start, end), ...]` — makes
  matched spans invisible to EVERY rule: no spelling/space/capitalization/
  culture flags, no repetition counting (an excluded word is not an echo
  partner), no `localFix`/`applyFixes` edits, no panel replace-all or
  collapse touching them, and `concordance`/`repetitionReport` skip them.
  Accepted at `create` (instance default) and per call (`opts.exclude`;
  pass `null` to disable). The host page knows its own markup: a wiki-style
  editor might exclude its double-brace component blocks; other hosts might
  exclude fenced code, template tags, or bare URLs.

## 3.4.0 — 2026-08-02

- Hover pulse rework: pulsing now starts the instant the pointer enters a
  panel row and stops the instant it leaves — no trailing animation, ever,
  and only one row's marks pulse at a time. Echo/repeat rows pulse EVERY
  occurrence of the word together. Controller API: `pulseStart(starts)` /
  `pulseStop()` replace `flashAt(offset)`.
- Clicking anywhere on a panel row's background (not just "select") selects
  the issue's text in the textarea.
- Persistent ignore: every word row carries an `ignore` button — a per-word
  mute stored in localStorage (`customDictStorageKey + ":ignored"`), separate
  from the personal dictionary. A 3-second "undo ignore" chip guards against
  misclicks; the header's `ignored (N)` button opens the full list for
  one-by-one unignoring or a two-click-confirmed "unignore all". Checker
  API: `ignoreWord`, `unignoreWord`, `unignoreAll`, `listIgnoredWords`.
- Normal-case fallback: an all-caps word with no dictionary suggestions now
  offers its normal-cased form (SMITTH → Smitth) as a one-click fix.
- New `culture` rule (own gentle teal): nation/group/language/religion
  names written lowercase — "japanese" → Japanese, "usa" → USA. The default
  list is deliberately conservative: words whose lowercase form is a common
  English word (turkey, china, polish, black...) are excluded to avoid
  constant false positives; add project-specific entries via
  `options.cultureWords`. On in standard/strict, off in casual. `+dict` and
  `ignore` both exempt a word.
- Formality chooser: three always-visible buttons — casual / normal /
  formal — mapping to the casual/standard/strict profiles, persisted per
  origin (`formalityStorageKey`, default `mcphee_formality`). The selected
  level is a thick-bordered, obviously-different button.
- Rule config: a `⚙ config` toggle beside the chooser opens per-rule
  on/off checkboxes plus the three repetition knobs (echo window, echo
  common-rank exemption, obscure rank threshold), persisted per origin as
  overrides on top of the chosen formality (`ruleOverridesStorageKey`,
  default `mcphee_rule_overrides`).
- Overlay integrity self-check (never display wrong highlights): after
  every render the controller verifies content parity (backdrop text ===
  textarea value) and wrap parity (equal scrollHeights). On violation it
  re-mirrors and re-renders once; if the invariant still fails the overlay
  hides itself — fail closed, a missing highlight beats a misplaced one —
  warns on the console, and keeps retrying on the background poll until it
  verifies again. See DESIGN.md "Overlay correctness".
- Node smoke tests for the analysis layer: `test/node-smoke-3.4.js`.

## 3.3.0 — 2026-08-02

- New `dock(textarea, opts)`: batteries-included layout that claims space
  for the whole McPhee UI. Two placements, switchable live from the panel
  chrome and remembered in localStorage (per origin, so every
  hostname/browser pair keeps its own choice):
  - `inline` — the textarea keeps ~70% of its row; the panel docks beside
    it (sticky, rides along with page scroll; `panelFraction` tunes the
    split).
  - `drawer` — the textarea keeps all its space; the panel slides in from
    the right edge, opened by a floating "✓ spelling" handle or
    `openDrawer()`.
- Scroll linkage (`followViewport`, default on with a controller): panel
  rows whose every occurrence is scrolled off screen are dimmed, so the
  bright rows always correspond to text currently in view. Judged against
  the textarea-viewport intersection, so it works for inner-scrolling and
  auto-grown textareas alike. New controller method `visibleStarts()`.
- Caret linkage (`followCaret`, default on with a controller): the panel
  row nearest the caret is highlighted and kept scrolled into view in the
  panel — navigate the text to reach its corrections.
- Demo now dogfoods `dock()`.

## 3.2.0 — 2026-08-02

- Force regenerate: the panel header now carries a `↻ recheck` button that
  fully rebuilds the overlay (styles, geometry, marks) and the panel.
  `controller.refresh(true)` is the same operation programmatically.
- `refresh(true)` and `setEnabled(true)` now re-mirror the textarea's
  computed styles instead of trusting the copy taken at attach time, so
  late-loading fonts, theme switches, or zoom changes can no longer leave
  the backdrop wrapping differently than the textarea.
- The backdrop additionally mirrors `white-space`, `overflow-wrap`,
  `word-break`, `tab-size`, and `direction` from the textarea (previously
  stylesheet defaults were trusted), guarding against site CSS that
  restyles textareas.
- Verified aligned in-browser across: programmatic phrase moves, real
  typing, toggle off → edit → toggle on, scrolling, element resize, and
  110% zoom — on both the demo page and a host article editor.

## 3.1.0 — 2026-08-02

- Panel rows are a three-slot grid (content | dict-action | select): every
  `+ dict`/`dismiss` and every `select` button aligns vertically across rows.
- Hovering a panel row now gently flashes the issue's mark in the text
  (blue pulse, two beats) in addition to the hover-scroll. New controller
  method `flashAt(offset)`; overlay marks carry `data-start`.

## 3.0.3 — 2026-08-02

- Panel ordering refined per author feedback on 3.0.2: sections by issue
  type — misspelled (red), unknown (blue), repetition, capitalization,
  punctuation, extra spaces — with document order (first occurrence) within
  each section.

## 3.0.2 — 2026-08-02

- Panel rows are sorted by text position (first occurrence), all kinds
  merged. Previously spelling rows came first and repetition rows after,
  each in document order but not interleaved — the panel now reads in the
  same order as the text.

## 3.0.1 — 2026-08-02

- Fix overlay mark drift on `content-box` textareas: the backdrop is now
  always `border-box` instead of mirroring the textarea's `box-sizing`.
  Mirroring content-box double-counted padding/borders, so the backdrop
  wrapped ~18px wider and every mark drifted leftward within wrapped lines.
  Hosts with a global `* { box-sizing: border-box }` reset never saw it;
  the demo page did. Diagnosed with a computed-style diff, verified
  pixel-aligned in-browser.
- Panel rows no longer wrap: `.mcphee-panel-item` is `nowrap` with
  non-shrinking children. Give the panel container ~430px or more.

## 3.0.0 — 2026-08-02

Breaking: `guardForm`'s `allowOverride`/`overrideMs` options are gone. A
guard is a hard block — fix the words or add them to the dictionary; the
unchanged-resubmit-within-6s escape hatch no longer exists anywhere
(author's decision: no belt-and-suspenders; rely on the mechanism). No
consumer used the options.

## extension 0.2.0 — 2026-08-02

- Escape hatch removed (author's decision: no belt-and-suspenders). A guard
  is a hard block; the only ways through are fixing the words or `+ dict`.
- Fails closed: clicking the guarded button while the dictionary is still
  parsing blocks with a "still loading" toast instead of passing unchecked.
- `testbed.html`: fake x.com composer (contenteditable +
  `data-testid` button, no form) for end-to-end guard testing.

## extension 0.1.0 — 2026-08-02

McPhee Guard, the Firefox extension (`extension/`, versioned separately from
the library; library unchanged at 2.1.0):

- Teach-a-guard flow: popup → click the editable → click the submit button.
  Guards are per browser profile, stored per origin in `storage.local`.
- Blocks the taught button (and Ctrl/Cmd+Enter in the taught field) in the
  capture phase while the text has misspelled words; toast lists them with
  `+ dict`. Unchanged-text resubmit within 6 s passes — the escape hatch.
- `casual` profile, misspellings only; @handles, #hashtags, and URLs are
  masked before analysis. Dictionary loads lazily, only on guarded origins.
- Personal dictionary in extension storage, shared across sites in the
  profile; `+ dict` from any site silences the word everywhere.

## 2.1.0 — 2026-08-02

The Kedit `All` primitives, for building deep-look/concordance UIs:

- `concordance(text, word)` — every occurrence of one chosen word (case,
  possessive, plural folded) with offsets, word indexes, and the gaps
  between successive occurrences. No thresholds; judgment stays with the
  author, as in Kedit.
- `repetitionReport(text, { minLength, limit })` — the automatic All: every
  repeated word ranked by bunching surprise (expected gap N/k over closest
  actual gap), so bunched ordinary words surface and "the" never does. Rare
  words (>= obscureRank or unranked) sort above everything — one appearance
  per piece is the rule. Personal-dictionary/extraWords/dismissed words
  excluded.

## 2.0.0 — 2026-08-02

Renamed the library to **McPhee**, for John McPhee, who ran Kedit's `All`
command over every piece to spot repeated distinctive words and bunched
ordinary ones (*Draft No. 4*, "Structure") — the job this library's
repetition detectors now do. (The v1.4.0 entry below credited the practice
to Peter Matthiessen; the program anecdote is McPhee's. Matthiessen's
"you often do plagiarize yourself" quote is real but he worked by hand.)
Breaking changes, all mechanical:

- Global renamed to `McPhee`; files renamed to `mcphee.js/.css`; CSS class
  prefix renamed to `mcphee-*`.
- Default localStorage key renamed to `mcphee_custom_dict`. Hosts with
  explicit keys are unaffected; hosts using the default should
  `importWords` the old key once.
- No behavior changes.

## 1.5.0 — 2026-08-02

- Every issues-panel row gets a `select` button ("move cursor here"): focuses
  the textarea with the issue's text SELECTED, ready to retype over, and
  scrolls it into view. The issue is re-located in the current text at click
  time, so stale offsets can't select the wrong span.
- Demo sample text replaced with the author's regression text covering the
  misspelled-vs-correct rare-word pair, gibberish runs, name-shaped unknowns
  (SMITTH / Smytye / fABJ), trailing-space runs before blank lines, and a
  far-apart obscure-reuse pair.

## 1.4.0 — 2026-08-02

Repetition detectors (the Matthiessen rules — after Peter Matthiessen, *Under
the Mountain Wall* / *The Snow Leopard*, who hated discovering he had reused a
word: "you often do plagiarize yourself"):

- New rule `echo`: the same content word (case/possessive/plural-folded)
  reappears within `echoWindowWords` words (default 50). Both occurrences get
  lavender marks. Function words (built-in stopword list) and words more
  common than `echoCommonRank` (default 2000) in the frequency list are
  exempt.
- New rule `obscureRepeat`: a dictionary word rarer than `obscureRank`
  (default 10000) — or absent from the frequency list — used 2+ times
  anywhere in the text. Every occurrence gets a light-green mark. Inert
  without a frequency list.
- New optional `freqUrl` create option pointing at a rank list (one word per
  line, most common first). Vendored: `vendor/wordfreq/en-30k.txt`, the top
  30,000 alphabetic words of Peter Norvig's Google Web Trillion Word Corpus
  counts (https://norvig.com/ngrams/).
- Personal-dictionary and `extraWords` entries are exempt from both detectors
  (topic vocabulary gets to repeat); adding a word to the dictionary is the
  permanent opt-out.
- No autofix — word choice is the author's. Panel rows show
  `word ×N · M words apart` / `word ×N · rare word reused` with
  hover-to-scroll and a session-scoped `dismiss` button
  (`checker.ignoreRepeat(word)`).
- Profiles: `standard` and `strict` enable both rules; `casual` disables both.

## 1.3.0 — 2026-08-02

- Hovering an issues-panel row scrolls the textarea to that issue's location
  (first occurrence for grouped word rows) so the author sees what they'd be
  correcting; rows get a subtle hover tint.
- New controller method `ctl.scrollToOffset(offset)` — positions any
  character offset roughly a third of the way down the view, measured from
  the mirrored backdrop so wrapping is exact.

## 1.2.0 — 2026-08-01

Space-run policy rework:

- Exactly two spaces after sentence-ending punctuation (`.` `!` `?` `…`,
  closing quotes/brackets allowed in between) are a deliberate sentence
  separator: never flagged, never collapsed.
- Line-leading space runs are indentation (Markdown code blocks, list
  continuations): never flagged, never collapsed.
- Every other 2+ space run is a violation rendered as ONE joined yellow
  rectangle with no internal divisions (previously each extra space got its
  own box).
- Fixes (`localFix`, `applyFixes`, panel collapse) shrink a sentence
  separator that grew to 3+ spaces back to two spaces, and any other
  violation to one; `doublespace` issues now carry `collapseTo`.
- Panel wording: "N extra-space runs".

## 1.1.0 — 2026-08-01

Standalone repo established (previously lived only as a drop-in inside a
host project).

- Rule profiles: `standard` (historical behavior), `strict`, `casual`
  (the "japanese" mode — no unknown-word/capitalization/punctuation nagging).
  Per-call `{ profile }` / `{ rules }` overrides on every entry point;
  `ctl.setRules()` switches live.
- New strict-profile rules: `sentenceCapitalization` (lowercase sentence-start
  dictionary word, orange) and `terminalPunctuation` (text ends without
  terminal punctuation, orange-outlined last character). Capitalization is
  auto-fixable; punctuation is highlight-only.
- Undo-preserving edits: new `applyFixes(textarea)` and all panel actions go
  through `execCommand("insertText")` (fallback `setRangeText`), fixing an
  earlier prototype's bug where `.value` writes wiped the native undo stack.
- `attachPanel({ textarea, container, controller })`: live issues panel with
  replace-all suggestion buttons, add-to-dictionary, capitalize, and
  collapse-double-spaces actions plus a personal-dictionary word count.
- `guardForm(form, { blockOn, watch, allowOverride, onBlock })`: blocks form
  submission while blocking issues exist; `watch: true` live-disables submit
  buttons; unchanged-text resubmit within 6s overrides (escape hatch).
- `importWords(words)`: union-merge for storage-key migration and future
  remote dictionary sync.
- `version` and `profiles` exposed on the global.

## 1.0.0 — 2026-07-28

First packaged drop-in: overlay highlighting (misspelled/unknown/
doublespace), `localFix`, `analyze`, localStorage personal dictionary,
`extraWords`, `autofixMap`. Grown from two earlier private prototypes.
