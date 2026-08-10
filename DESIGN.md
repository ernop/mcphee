# McPhee cross-project design

One personal spellcheck system, reused everywhere: the creator's article
editors, prompt boxes, one-off pages, and the McPhee Guard Firefox extension
(`extension/`) that gates submission on arbitrary sites. This document
records the architecture decisions and the not-yet-built roadmap so each
host copy can catch up to master with a folder copy and minor wiring.

## Personalization model (borrowed from cSpell)

cSpell (VS Code's spellchecker) has the best-studied personalization layering,
and McPhee adopts its two core ideas:

1. **Word lists always union; settings override.** Merging configuration never
   loses dictionary words. This is what makes multi-source dictionaries and
   sync trivially safe: a word list is a grow-only set, so merge = union, and
   removal is an explicit, rare operation.
2. **Dictionaries have scope; exactly one scope has `addWords`.** cSpell scopes
   dictionaries `user` / `workspace` / `folder` and marks which one the
   "add word" action writes to. McPhee's equivalent layers:

| layer | McPhee mechanism | grows via | scope |
| --- | --- | --- | --- |
| base language | Hunspell en_US (vendored) | never (replace file) | universal |
| built-in autofix | `COMMON_TYPOS` map | canonical repo commits | universal |
| project jargon | `extraWords` + `autofixMap` options | project commits | per project |
| personal dictionary | localStorage under `customDictStorageKey` | `addCustomWord` (the only `addWords` layer) | per user, per origin |
| context rules | profiles (`standard`/`strict`/`casual`) + per-call `rules` overrides | code | per textarea / per call |

Profiles are cSpell's `languageSettings`/`overrides` analog: the word layers
stay constant while rule strictness flips per context. The "japanese" use case
(intentionally lowercase, unpunctuated prose) is `casual`; a form that must not
be submitted with errors is `strict` + `guardForm`.

## Personal dictionary sync (designed, not yet built)

Problem: localStorage is per-origin *and* per-browser. Words added in one
host app still nag in another; words added on the desktop nag on the
laptop.

Options considered:

- **Extension `storage.sync`**: 100 KB total / 8 KB per item / 512 items;
  requires sharding the word list across keys; Firefox for Android doesn't
  sync it; only reachable from the extension, not from ordinary pages.
  Verdict: fine as the extension's own cache, wrong as the canonical store.
- **Grammarly/LanguageTool model** (account-backed server dictionary): correct
  architecture, and the creator already runs a personal always-on server.
- **Flat file in each repo**: no good; per-machine, needs commits for words.

Decision: **the creator's server is the dictionary hub**; every client keeps
localStorage as an offline cache and union-merges with the server.

Contract (to implement on that server behind its authenticated admin prefix):

```text
GET  /<ADMIN_PREFIX>/api/mcphee/dict
     -> { "updated": "<iso8601>", "words": ["anaphora", ...] }
POST /<ADMIN_PREFIX>/api/mcphee/dict
     body { "add": ["word", ...], "remove": ["word", ...] }
     -> same shape as GET (post-merge state)
```

- Storage: one row/file server-side; a sorted word list (hunspell personal-dic
  style). Django auth session = identity; no per-word metadata needed.
- Client behavior (future `remote` option on `McPhee.create`):
  on create, GET and `importWords()` (union); `addCustomWord` POSTs
  `{add}` best-effort, queueing in localStorage while offline. Deletions only
  through an explicit UI, POSTing `{remove}` — union sync can never resurrect
  them accidentally as long as removal also deletes from the local cache.
- Conflict story: none needed. Adds are a set union; concurrent adds commute.
- The Firefox extension syncs the same endpoint (its host permissions already
  include that server) and additionally mirrors to `storage.sync` (sharded,
  ~8 KB per chunk) so a fresh browser profile works before first server login.

## Form-submission gating (built: `guardForm`)

`guardForm(form, opts)` is the reusable primitive: capture-phase submit
listener + optional `watch` mode that live-disables submit buttons while
blocking issues exist. Two policies worth naming:

- A guard is a hard block everywhere (v3.0.0, author's decision 2026-08-02:
  no escape hatches — if the mechanism works, rely on it). The response to a
  false positive is add-to-dict, which unblocks immediately. Through v2.1.0
  `allowOverride` let an unchanged resubmit within 6 s pass; removed.
- `watch: true` is the "insists" mode — the submit button stays disabled
  while blocking issues exist, instead of rejecting at submit time.

## Repetition detectors (`echo` + `obscureRepeat`; phrase echo added v3.9.0)

Inspired by John McPhee's use of Kedit's `All` command (*Draft No. 4*,
"Structure"): show every occurrence of a chosen word with the distances
between them, reconsider any distinctive word appearing twice in a piece, and
respace ordinary words that bunch. (Originally misattributed here to Peter
Matthiessen, whose "you often do plagiarize yourself" is real but manual.)
Design decisions:

- **General phrase discovery, not a phrase list**: `echo` compares every pair
  of dictionary-known word starts within `echoWindowWords` and extends each
  pair to its maximal identical multi-word sequence. Matching is
  case/apostrophe-insensitive but otherwise exact; function words participate,
  so two nearby uses of "at all" are found without naming that phrase in
  advance. Punctuation, exclusion zones, misspellings, and active non-repeat
  issues bound phrases. Competing nested matches are ranked by how much
  repeated text they explain, yielding one useful full-span row rather than
  rows for every contained bigram and trigram. Phrase echoes supersede weaker
  single-word echoes over the same spans.
- **Frequency data over word lists**: a single vendored rank list
  (`vendor/wordfreq/en-30k.txt`, Norvig's Google-corpus counts) powers both
  word-level detectors and their exemptions. Rank thresholds, not booleans,
  so sensitivity is a dial: `echoCommonRank` (2000) keeps everyday individual
  words out of echo; `obscureRank` (10000) defines "obscure". Phrase discovery
  does not use frequency gates because the repeated sequence itself is the
  signal. The web corpus skews odd in places (it ranks "deliberate" as rare),
  which errs toward flagging — the right direction for a style aid with a
  one-click dismiss.
- **No autofix, ever**: unlike spelling, repetition has no mechanical
  correction — choosing the replacement word is exactly the author's job. The
  tooling's whole duty is *locating* the echo (marks + hover-to-scroll) and
  getting out of the way (dismiss).
- **Two exemption tiers**: personal-dictionary/extraWords words are
  permanently exempt (topic vocabulary must be allowed to repeat — an article
  about leopards says "leopard" fifty times), while `ignoreRepeat(value)` is
  session-only (deliberate anaphora in one article says nothing about the
  next). For a phrase, the dismissal key is its exact normalized token
  sequence and suppresses the weaker component-word echoes it superseded.
- Plural/possessive folding is naive (strip `'s`, strip one trailing `s` from
  5+-letter non-`ss` words) — good enough for detection; real stemming would
  add false pairs.

## Firefox extension — McPhee Guard (MVP shipped 2026-08-02, `extension/`)

WebExtension wrapping this same core; deliberately invasive by design
(refuses a site's submit/tweet button while text contains misspelled words).

Built (v0.1.0):

- **Taught guards instead of per-site adapters.** The original plan was
  hand-written adapters for each composer; the shipped design lets the user
  teach a guard in two clicks (popup → click the editable → click the submit
  button). Selector generation prefers stable attributes (`data-testid`,
  `id`, `name`, `aria-label`) and falls back to a structural path; selectors
  are resolved at event time so SPA re-renders can't stale them. Works for
  `contenteditable` composers (x.com) and real forms alike.
- **Gate, not overlay.** No inline marks in v0.1 (the CSS Custom Highlight
  API is still not in Firefox, verified 2026-08). Blocking happens in the
  capture phase at document level (click on the taught button, or
  Ctrl/Cmd+Enter inside the taught field) before the page's handlers run; a
  toast lists the misspelled words with `+ dict` buttons. `casual` profile,
  `misspelled` only; @handles, #hashtags, and URLs are masked out before
  analysis so they can't false-block.
- **Hard block, no escape hatch** (v0.2.0, author's decision 2026-08-02: no
  belt-and-suspenders — if the mechanism works, rely on it). The only ways
  through are fixing the words or `+ dict`. Fails closed while the
  dictionary is parsing. v0.1.0 briefly had a resubmit-within-6s override;
  removed. Recovery from a misbehaving guard is the popup (remove guard /
  global switch), not a per-submit loophole.
- **Dictionaries**: Hunspell files bundled (copied in by `extension/build.ps1`).
  On guarded origins the dictionary loads immediately at page load; unguarded
  origins load nothing because there is nothing to check. Personal dictionary
  lives in `storage.local` (per browser profile, shared across sites), kept
  consistent across open tabs via `storage.onChanged`.
- **Manifest**: MV3, `browser_specific_settings.gecko.id` set.
- **Popup**: teach button, per-origin guard list with remove, global kill
  switch, dictionary word count.

Still to build: dictionary-sync endpoint integration with a `storage.sync`
mirror, optional overlay marks for textareas, per-guard profile/blockOn
overrides, and an AMO-signed build.

## Overlay correctness (v3.4.0): how we never show wrong highlights

Misaligned highlights were observed repeatedly during development. This
section is the systematic answer: why they happen, why the architecture is
what it is, and the invariants that now make wrongness self-detecting.

### Why not a different library or API?

Every option for coloring text inside a `<textarea>` was considered:

- **CSS Custom Highlight API** (`::highlight()`): the modern right answer
  for DOM text — but it operates on Ranges over text nodes and cannot see
  inside a textarea's value. Not applicable.
- **contenteditable / editor frameworks** (CodeMirror, Monaco,
  ProseMirror): these own the text surface, so their highlights can never
  drift — but they replace the textarea, its native undo, its mobile
  behavior, its form semantics, and every consumer's existing wiring.
  McPhee's contract is "drop in next to a plain textarea", so owning the
  surface is out.
- **Mirror-div overlay** (what McPhee and every textarea-highlighting
  library — highlight-within-textarea etc. — uses): the only approach
  compatible with keeping the native textarea. Its single failure mode is
  *divergence*: the mirror wrapping differently than the textarea.

So the architecture keeps the mirror, and treats divergence as a detectable,
recoverable error rather than a hope.

### The two invariants

After every render these must hold, or the marks are lies:

1. **Content parity** — `backdrop.textContent === textarea.value + "\n"`
   (the trailing newline is the scroll-parity line). Guarantees every mark
   sits on exactly the characters the analysis measured.
2. **Wrap parity** — `|backdrop.scrollHeight − textarea.scrollHeight| ≤ 2`.
   Same text + same metrics + same width ⇒ same wrap points ⇒ same height;
   a height difference is direct evidence the layouts diverged (fonts,
   zoom, box-sizing, site CSS, anything).

### The enforcement ladder

1. Every render verifies both invariants.
2. First violation: automatic self-repair — re-mirror all wrap-affecting
   computed styles, re-render, re-verify (handles late-loading fonts, theme
   flips, zoom).
3. Still violated: **fail closed.** The overlay hides itself, warns on the
   console with diagnostics, and retries on the background poll until it
   verifies again. A missing highlight is an inconvenience; a misplaced one
   is misinformation. (Same philosophy as the extension's hard block.)

### Known divergence causes, each with its defense

| cause | defense |
| --- | --- |
| box-sizing mismatch (content-box textareas) | backdrop forced to border-box, sized from the textarea's client box (v3.0.1) |
| vertical scrollbar shrinking wrap width | width taken from client box, not offset box |
| late-loading fonts / theme switch / zoom | styles re-mirrored on every forced refresh + on re-enable (v3.2.0); invariant check catches the rest |
| site CSS restyling textareas | `white-space`, `overflow-wrap`, `word-break`, `tab-size`, `direction` mirrored explicitly (v3.2.0) |
| programmatic `.value` writes with no event | 700 ms background poll re-renders on any value change |
| stale geometry after element resize | ResizeObserver re-syncs; `refresh(true)` re-measures everything |
| anything unforeseen | the two invariants + fail-closed hiding |

### Rules for future work (the guide)

- Never write a mark's position from anything but offsets computed against
  the exact string that was rendered.
- Never style the backdrop's text metrics independently of the textarea —
  every wrap-affecting property must be mirrored or pinned identical.
- Any new render path must end in the invariant check; there is exactly one
  place that writes `backdrop.innerHTML` (keep it that way).
- When adding mark types, marks must wrap text spans only — never insert or
  remove characters (content parity would break instantly and visibly).
- Prefer hiding to guessing: any state where correctness is unprovable
  renders as no overlay, not a best-effort overlay.

## Versioning and distribution

- `McPhee.version` + `CHANGELOG.md` are the contract; bump the version on
  every behavior change.
- Distribution stays copy-the-folder: a host copy can never break because
  master changed, and there is no npm/build machinery to maintain for what is
  a static folder. "Catching up to master" = re-copy + read the changelog
  diff + adjust wiring if an API changed (avoided when possible; additions
  only).

## Non-goals

- Grammar checking beyond the cheap deterministic rules (that's an LLM's
  job).
- Multi-language dictionaries (en_US only until a real need appears).
- Server-side rendering integration; McPhee is a client-side authoring aid.
