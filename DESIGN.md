# McPhee cross-project design

One personal spellcheck system, reused everywhere: fuseki4_ai article editor,
multiImageClient prompt box, stalin-mode-style one-off pages, and eventually a
Firefox extension that gates form submission on arbitrary sites. This document
records the architecture decisions and the not-yet-built roadmap so each
consumer can catch up to master with a folder copy and minor wiring.

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

Problem: localStorage is per-origin *and* per-browser. Words added in
multiImageClient still nag in fuseki; words added on the desktop nag on the
laptop.

Options considered:

- **Extension `storage.sync`**: 100 KB total / 8 KB per item / 512 items;
  requires sharding the word list across keys; Firefox for Android doesn't
  sync it; only reachable from the extension, not from ordinary pages.
  Verdict: fine as the extension's own cache, wrong as the canonical store.
- **Grammarly/LanguageTool model** (account-backed server dictionary): correct
  architecture, and we already run a personal always-on server — fuseki.net.
- **Flat file in each repo**: no good; per-machine, needs commits for words.

Decision: **fuseki.net is the dictionary hub**; every client keeps localStorage
as an offline cache and union-merges with the server.

Contract (to implement in fuseki4_ai behind the authenticated admin prefix):

```text
GET  /<ADMIN_PREFIX>/api/mcphee/dict
     -> { "updated": "<iso8601>", "words": ["fuseki", ...] }
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
- The Firefox extension syncs the same endpoint (its host permission already
  includes fuseki.net) and additionally mirrors to `storage.sync` (sharded,
  ~8 KB per chunk) so a fresh browser profile works before first fuseki login.

## Form-submission gating (built: `guardForm`)

`guardForm(form, opts)` is the reusable primitive: capture-phase submit
listener + optional `watch` mode that live-disables submit buttons while
blocking issues exist. Two policies worth naming:

- **Own apps** (`allowOverride: true`, default): a false positive must never
  hold the author hostage; resubmitting the same unchanged text within 6 s
  passes. The right long-term response to a false positive is add-to-dict.
- **Extension mode** (`allowOverride: false`, `watch: true`): the "insists"
  mode — the submit button stays disabled until the text is clean or the word
  is added to the dictionary.

## Repetition detectors (built: `echo` + `obscureRepeat` rules, v1.4.0)

Inspired by John McPhee's use of Kedit's `All` command (*Draft No. 4*,
"Structure"): show every occurrence of a chosen word with the distances
between them, reconsider any distinctive word appearing twice in a piece, and
respace ordinary words that bunch. (Originally misattributed here to Peter
Matthiessen, whose "you often do plagiarize yourself" is real but manual.)
Design decisions:

- **Frequency data over word lists**: a single vendored rank list
  (`vendor/wordfreq/en-30k.txt`, Norvig's Google-corpus counts) powers both
  detectors and their exemptions. Rank thresholds, not booleans, so
  sensitivity is a dial: `echoCommonRank` (2000) keeps everyday words out of
  echo; `obscureRank` (10000) defines "obscure". The web corpus skews odd in
  places (it ranks "deliberate" as rare), which errs toward flagging — the
  right direction for a style aid with a one-click dismiss.
- **No autofix, ever**: unlike spelling, repetition has no mechanical
  correction — choosing the replacement word is exactly the author's job. The
  tooling's whole duty is *locating* the echo (marks + hover-to-scroll) and
  getting out of the way (dismiss).
- **Two exemption tiers**: personal-dictionary/extraWords words are
  permanently exempt (topic vocabulary must be allowed to repeat — an article
  about fuseki says "fuseki" fifty times), while `ignoreRepeat(word)` is
  session-only (deliberate anaphora in one article says nothing about the
  next).
- Plural/possessive folding is naive (strip `'s`, strip one trailing `s` from
  5+-letter non-`ss` words) — good enough for detection; real stemming would
  add false pairs.

## Firefox extension (next major milestone)

WebExtension wrapping this same core; deliberately invasive by design (may
disable a site's submit/tweet button while text contains egregious errors).

Architecture:

- **Content script** = mcphee.js + a site adapter layer. For `<textarea>`s
  the mirrored-backdrop overlay works as-is. `contenteditable` (Twitter/X
  composer, Gmail) needs a different marking strategy — the CSS Custom
  Highlight API is still not in Firefox (verified 2026-08), so v1 ships
  textarea support everywhere + per-site adapters for the few contenteditable
  composers that matter (adapter = locate editor root + submit button; gate
  the button on `analyze(editorText)` without visual marks, or with a small
  issue-count badge instead of inline highlights).
- **Dictionaries**: Hunspell files bundled with the extension (no fetch);
  personal dictionary from the fuseki.net endpoint, mirrored to
  `storage.sync` (sharded under the 8 KB item quota, 100 KB total is ample
  for a personal word list), `storage.onChanged` keeps open tabs consistent.
- **Config**: per-site profile map in `storage.sync`, e.g.
  `{ "twitter.com": { profile: "casual", blockOn: ["misspelled"], allowOverride: false } }`,
  default `standard` with gating off (highlight-only) for unknown sites.
- **Manifest**: MV2-or-MV3 per current Firefox policy at build time;
  `browser_specific_settings.gecko.id` is required for `storage.sync`.
- Popup UI: current-site profile switcher, issue list (reuse `attachPanel`
  rendering), add-to-dictionary, and a global kill switch.

## Versioning and distribution

- Canonical repo: `C:\proj\mcphee` (git). `McPhee.version` +
  `CHANGELOG.md` are the contract; bump the version on every behavior change.
- Distribution stays copy-the-folder: consumers can never break because master
  changed, and there is no npm/build machinery to maintain for what is a
  static folder. "Catching up to master" = re-copy + read the changelog diff
  + adjust wiring if an API changed (avoided when possible; additions only).
- Consumers and their pinned versions are listed in README "Distribution".

## Non-goals

- Grammar checking beyond the cheap deterministic rules (that's an LLM's job —
  multiImageClient's separate Claude spellfix button covers it there).
- Multi-language dictionaries (en_US only until a real need appears).
- Server-side rendering integration; McPhee is a client-side authoring aid.
