# McPhee — Project Index for Agents

This is the master index. Every human or automated agent starts here. All
project documentation is linked through this file; no doc may exist outside
this tree.

## What This Repo Is

McPhee: a personal, customizable, minimal spellchecker — plus some other fun
stuff: detection of repeated obscure words, detection of mistaken nearby word
reuse, and better spellchecking than the pitiful checkers Google and Apple
ship. Product description for users is in [README.md](README.md).

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

Technical:

- [Integration guide](docs/integration.md) — files, setup, full API,
  rule catalog with exact parameters, rule profiles, design notes,
  distribution.
- [DESIGN.md](DESIGN.md) — architecture: personalization layering,
  dictionary sync design, form gating, repetition detectors, overlay
  correctness invariants, extension design, versioning.
- [CHANGELOG.md](CHANGELOG.md) — version history. Bump the version on every
  behavior change.
- [extension/README.md](extension/README.md) — the Firefox extension:
  build, load, teach.
- `test/` — Node smoke suites for the analysis layer. Run with
  `node test/<file>` from the repo root; all must pass before a release.

## Working Rules for Agents

- Distribution is copy-the-folder. The creator's other projects take
  verbatim copies of this folder; keep the folder self-contained.
- The overlay's correctness policy is fail-closed: never display a highlight
  that might be misaligned. See DESIGN.md "Overlay correctness" before
  touching any render path.
- Form guards are hard blocks. No escape hatches, no overrides, no lazy
  loading. If the mechanism works, rely on it.
- Run the Node smoke tests before committing library changes.
