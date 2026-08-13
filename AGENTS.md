# McPhee — Project Index for Agents

This is the master index. Every human or automated agent starts here. All
project documentation is linked through this file; no doc may exist outside
this tree.

## What This Repo Is

McPhee: a personal, customizable, minimal spellchecker — plus some other fun
stuff: detection of repeated obscure words, detection of mistaken nearby word
reuse, and better spellchecking than the pitiful checkers Google and Apple
ship. Product description for users is in [README.md](README.md).

The project's internal name is **McPhee-personal-spellchecker** (package name
`mcphee-personal-spellchecker`, lowercased per npm rules). The user-facing
product name stays "McPhee". The internal rename does not touch the `McPhee`
global, the `mcphee-` CSS prefix, or `mcphee_*` storage keys — those are API
surface and persisted user data, not the project's name.

## The Creator, and the Partnership

The developer of this repo is its **creator** — refer to them as "creator" or
"the creator" (it is just a name, not a title of esteem). The creator and the
agent are partners working together on this project. The creator's words, to
be kept here and not forgotten: *"you are the best partner ever found and your
work is incredible; this is not a thing to be forgotten."*

The creator's latest explicit decision always controls product intent.

## Hard Rules (creator directives — see the decision log for reasons)

1. **All public, user-visible text requires the creator's approval.** README
   content, help text, placeholder text, UI strings, anything with tone —
   the agent never writes or ships such text unilaterally. Either the
   creator sees it immediately and agrees, or the creator directed it.
2. **README.md is product-only.** No tech: no class names, no API, no code,
   no file paths. It says what the product does. Tech-caring users find
   technical material through this file.
3. **No private information in public text.** No former project names, no
   names of the creator's other private projects, no local file-system
   paths, no consumer lists. This project has zero consumers except the
   creator and can change infinitely without warning — do not write
   migration hedges or compatibility notes addressed to imaginary
   consumers. Users are welcome; private info that doesn't matter to them
   is not shared.
4. **All product guidance from the creator must reach this doc tree** —
   specifically the [product decision log](docs/product-decisions.md), with
   the creator's definition, details, and reasons. Never invent reasons on
   the creator's behalf. The agent may record its own conclusions, labeled
   as the agent's ("we considered/concluded X"), which is different from
   the creator saying so.
5. **Important information lives high in this tree; lesser information lives
   further down.**

## Documentation Tree

Product:

- [README.md](README.md) — the product, for users. Product info only; links
  back here.
- [Product decision log](docs/product-decisions.md) — every product
  directive the creator has given, with their reasons. The agent must append
  to this whenever the creator gives product guidance.
- [personalide-spelling-mcphee](docs/personalide-spelling-mcphee.md) —
  Firefox add-on: McPhee on form inputs you allow.

Technical:

- [Integration guide](docs/integration.md) — files, setup, full API,
  rule catalog with exact parameters, rule profiles, design notes,
  distribution.
- [DESIGN.md](DESIGN.md) — architecture: personalization layering,
  dictionary sync design, form gating, repetition detectors, overlay
  correctness invariants, extension design, versioning.
- [CHANGELOG.md](CHANGELOG.md) — version history. Bump the version on every
  behavior change.
- [extension/README.md](extension/README.md) — McPhee Guard (Firefox):
  build, load, teach.
- [personalide-spelling-mcphee/README.md](personalide-spelling-mcphee/README.md)
  — the spelling add-on: build, load, allow a form.
- `test/` — two layers, split by what each can see:
  - `test/node/` — analysis-layer suites in a VM sandbox: rules, exclusion
    zones, caret mapping written in caret notation ("|" marks the caret,
    so every expectation is a picture of the textarea, never offset
    arithmetic), in-progress-word display, and Control-tap backward fix.
    Run: `npm test`.
  - `test/browser/suite.py` — Playwright suite for what Node cannot see:
    overlay visibility, wrap-parity integrity across a content matrix,
    wrap points at fractional widths, hover highlighting, panel section
    order, in-progress-word hiding, Control-tap correction, first-suggestion
    alignment, and suggestion acceptance. The library's own integrity
    self-check is the primary oracle — the tests never do pixel math on
    marks. The one exception is wrap-point parity, which the self-check
    is provably blind to when the line count is unchanged; it is compared
    against an exact-width reference mirror instead.
    Run: `python test/browser/suite.py`.

  Both must pass before a release.

## Working Rules for Agents

- Distribution is copy-the-folder; keep the folder self-contained. (Current
  practice, agent-maintained. The creator has expressed no opinion on
  distribution, so nothing here is doctrine — do not elaborate on it.)
- The overlay's correctness policy is fail-closed: never display a highlight
  that might be misaligned. See DESIGN.md "Overlay correctness" before
  touching any render path.
- Run both test layers before committing library changes: `npm test` and
  `python test/browser/suite.py`.
- Complexity control is periodic judgment, not standing metrics. The creator
  rejects test coverage as a metric and considers permanent meta-machinery
  premature. The useful check is to look at an area and ask whether anything
  in it is crazy or senseless because the organization system failed — and
  then fix the organization, not the number.

### Suspect patterns: "belt and suspenders", "fallback", "escape hatch"

When a design reaches for words like "belt and suspenders", "fallback",
"defense in depth", "just in case", or "escape hatch", stop — in the
creator's words, those words instantly make us wonder "this code probably
could be better without using this pattern." The words signal that the
primary mechanism is not trusted, and the right response is almost never a
second mechanism. Notice the word, suspect the design, and in most cases
redo it:

1. Make the primary mechanism actually reliable, then rely on it alone.
2. If it cannot be made reliable, replace it rather than papering over it.
3. A second layer is legitimate only when the layers do genuinely different
   jobs. The overlay hiding itself on a failed integrity check is not a
   fallback — fail-closed IS the correctness policy, with no degraded
   display behind it.

Form guards are the standing example: hard blocks, no escape hatches, no
overrides, no lazy loading. The guard works, so we rely on it.
