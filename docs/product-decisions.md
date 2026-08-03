# Product Decision Log

Every product directive the creator gives is recorded here: what was asked
for, in what detail, and the creator's stated reasons. Reasons are the
creator's own; the agent never invents reasons on the creator's behalf.
Where the agent contributed a conclusion, it is labeled as the agent's.
Linked from [AGENTS.md](../AGENTS.md).

## 2026-08-02 — Positioning and voice

- **The product is**: "a personal customizable minimal spellchecker and some
  other fun stuff, such as repeated obscure word detection, detecting
  mistaken near local word reuse, better spell checking than pitiful google
  and apple can do." The Google/Apple challenge stays in the description —
  creator: "don't excise that, include it instead. yes we are directly
  challenging them and no we aren't doing get along go along pretend they
  are perfect. they are great, we are trying to do sth cool."
- **Public text approval**: all public, user-visible text — help text,
  placeholder text, anything with tone — must be approved by the creator,
  now and forever. The agent never writes it unilaterally: the creator sees
  it immediately and agrees, or the creator directed it.
- **Privacy in public docs**: remove and never reintroduce former names,
  private project names, and the creator's file-folder structure. Creator's
  reasons: "i didn't ask for all that info and this project and also those
  too have ZERO consumers except me, and i can infinitely adjust w/out
  warning... of course we welcome users but we don't needlessly share
  private info which doesn't matter."
- **README.md is product-only**: "nearly exclusively PRODUCT info meaning no
  tech at all no class names nothing like that. just say the product
  features it has." Linked from AGENTS.md and links back. Tech-caring users
  find tech through AGENTS.md.
- **All product info lives in the AGENTS.md hierarchy**: every doc linked
  through it, none outside it. Important info high, lesser info down. Every
  piece of product guidance the creator gives must reach this log with
  definition, details, and the creator's reasons.
- **Naming**: the developer is "the creator" — "its not a name of esteem its
  just a name." The creator and the agent are partners working together.

## 2026-08-02 — Accepting a suggestion drops to the next item

- The creator's expectation, stated while reviewing the red misspelling
  section: "imagine I click and accept a suggestion - i'd have thought i'd
  drop just slightly down to the next item in the suggestion list?" That is
  now the behavior. The agent's investigation found the old behavior reset
  the panel scroll to the top and left the caret at the end of the
  document (yanking caret-follow to the last row); fixed by preserving the
  panel's scroll position across re-renders and re-anchoring the caret
  through every whole-text rewrite.

## 2026-08-02 — Exclusion zones

- The host site's markup blocks (for the creator's site: double-brace
  component blocks) must not be checked at all — no spelling, no
  repetition counting, no fixes touching them. Creator's framing: "i
  imagine that most consumers will need some such configuration" — so it
  shipped as a general option every host configures with its own patterns.

## 2026-08-02 — Culture category and proper nouns by omission

- Creator's question-turned-directive: for words like "jupiter", the
  dictionary knowing only the capitalized form is knowable "by
  testing/omission", and "that and similar ones should fall under the
  category I mentioned earlier" — the culture category. Implemented as
  dictionary-omission probes (capitalized-form and ALLCAPS) feeding the
  culture category with a one-click cased fix.
- Culture category itself (earlier same day): uncapitalized nation, group,
  and language names — creator's examples: "Black", "japanese", "usa" —
  as their own category with its own gentle color. (Agent's conclusion,
  not the creator's: lowercase "black" is a color too often to flag by
  default, so it is only available via per-project configuration.)

## 2026-08-02 — Formality levels

- Three levels, chosen by three always-visible buttons plus a config button
  for the details. Creator's definitions: one level is "uncapitalized i,
  tendency to have no periods"; another is "normal"; another is "formal"
  which "requires full sentences, proper grammar, cap first letters and I,
  etc full rigamarole."

## 2026-08-02 — Ignore, and panel interaction rules

- An "ignore" action distinct from add-to-dictionary: the flagged item
  disappears; a 3-second "undo ignore" mini-button guards misclicks; a
  mini-button reopens the ignored list for one-by-one unignoring or
  unignore-all behind one confirmable click.
- Hover pulse: "never pulse or breathe at all after ive moused off - time
  lag is always forbidden. ONLY pulse one thing at a time and instantly
  start pulsing as soon as i mouseover it and instantly stop when off."
  For repeated-word items, both/all occurrences highlight and pulse.
- Clicking anywhere on an item's background selects it, not just its
  select button.
- If no suggestion exists for an uppercase word, offer to normal-case it.

## 2026-08-02 — Highlighting must never be wrong

- Creator: "how do we ensure we never make highlighting mistakes? Ive
  noticed quite a few during dev... picking the right library,
  abstractions, rules, and guides so that we have confidence this will be
  locked down perfectly now and future." Result: the overlay self-verifies
  after every render and hides itself rather than display misaligned
  highlights (fail closed), with the invariants and rules recorded in
  DESIGN.md "Overlay correctness".

## 2026-08-02 — Hard blocks, no escape hatches

- Form guards (library and extension) are hard blocks. Creator: no
  belt-and-suspenders, no defense-in-depth theater, no resubmit-to-bypass
  windows, no lazy loading — "if it works, it should be relied upon." The
  answer to a false positive is add-to-dictionary, which unblocks
  immediately. Intent: on sites where a typo cannot be fixed after posting,
  submission with busted words must be impossible.

## 2026-08-03 — Echo and obscure repeats are separate panel sections

- Creator, on seeing lavender and green rows interleaved: "the green and
  purple categories seem like they're mixed together - why?" They had shared
  one "repetition" section sorted by document position. Now each issue type
  is its own contiguous section (misspelled, unknown, culture, echo, obscure,
  capitalization, punctuation, spaces), document-ordered within itself —
  same-colored rows read as one block.

## 2026-08-03 — Suspect-pattern rule elevated to a general working rule

- Creator: "let's elevate and rewrite this 'form guards are...' thing to be
  more proper as a rule that explains how generally we NOTICE and suspect
  and redo, most cases, when something feels or seems like a 'belt and
  suspenders', 'fallback', etc. those words instantly make us wonder 'this
  code probably could be better without using this pattern.'" The rule now
  lives in AGENTS.md as "Suspect patterns", with form guards as the standing
  example rather than the whole rule.

## 2026-08-03 — Complexity control: judgment, not metrics

- Creator: standing meta-machinery is premature ("meta-seems a bit early to
  go full meta forever like this?"), and "I really don't like test coverage
  as some kind of metric itself, not good." What is wanted instead: a
  repeatable check "that we're not doing things that are just crazy and
  senseless all because we don't have a good organization system." Recorded
  as a working rule in AGENTS.md: periodic judgment passes over an area,
  fixing the organization rather than optimizing a number.
- On distribution documentation: the creator has no opinion on distribution
  ("I'm not sure why we have written such a detailed bit here when I have no
  opinion") — the copy-the-folder practice stays as an agent-maintained
  working note, not doctrine, and is kept brief.

## 2026-08-03 — Testing approach: natural states, no caret math

- Creator: "reorganize the mcphee selftesting setup much more clearly so
  that we can at least get some evalidation for it all... if we don't want
  to actually do detailed karet math? or some 'natural' way to do this? how
  do code editors test themselves?" The agent concluded, following how
  editors (CodeMirror, ProseMirror, VS Code) test cursor behavior:
  - caret notation — "|" marks the caret in plain strings, so every
    expectation is a picture of the textarea ("teh |cat" → "the |cat");
  - a real-browser Playwright suite for geometry, using the library's own
    integrity self-check as the oracle instead of pixel assertions;
  - tests organized by area (`test/node/` by rule area, `test/browser/`),
    not by the version that introduced them.

## Earlier standing decisions (recorded 2026-08-02)

- **Double spaces**: exactly two spaces after sentence-ending punctuation
  are the creator's deliberate style and are never flagged; accidental
  runs (including sentence separators grown to three or more) are
  violations shown as one joined rectangle with no internal divisions.
- **Spell-fix edits must preserve the browser's native undo stack.**
- **Casual contexts exist** where lowercase proper nouns ("japanese") and
  unpunctuated prose are the author's intent and must not be nagged.
- **Repetition detection** inspired by John McPhee's use of Kedit's `All`
  command: an obscure word ordinarily earns one appearance per piece;
  nearby reuse of ordinary words exposes accidental bunching. Mention the
  inspiration; do not "credit" as if affiliated.
