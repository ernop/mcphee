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

## 2026-08-03 — Hover highlight: solid color change, never motion

- Creator: "highlighting shall be full-background-of-word colorchanging. i
  hate pulsing especially eternal. also i hate transition efefcts." The
  hover effect is now a plain background swap on the whole word — applied
  and removed on the exact instants the pointer enters and leaves a panel
  row. No animation, no transition, anywhere in the library. This
  supersedes the 2026-08-02 pulse behavior (the instant-on/instant-off
  requirement from that decision still stands; the motion does not).

## 2026-08-03 — Both uses of a repeated word must be visible

- Creator: highlighting of the "dual case of using a word multiple times"
  must highlight BOTH occurrences — "i need to see both of the uses which
  we're speaking about in one way or the other." Repeat rows highlight
  every occurrence simultaneously with the solid hover color; the browser
  suite asserts at least two marks recolor when a repeat row is hovered.

## 2026-08-03 — Frequency-list gaps: fix the class, not just instances

- Creator, following the "won't" fix: "is there another way to handle these
  hyper-comon-actually but we mistakenly mark as rare words? by patching
  and fixing the list or something? surely somebody has done that?" The
  agent concluded contractions are a closed class of function words —
  standard stopword lists (NLTK's among them) carry them for exactly this
  reason — and added the full set to McPhee's stopwords, making them
  permanently invisible to both repetition detectors. Larger option
  available if ever wanted: replace the vendored Norvig ranks with a corpus
  that kept apostrophes (wordfreq, SUBTLEX, OpenSubtitles-derived lists),
  at the cost of shifting every rank and the obscure threshold's meaning.

## 2026-08-03 — Stale overlay-off preferences get one amnesty

- After the 3.7.0 overlay fix the creator still saw no highlighting: their
  browser had persisted `fuseki_mcphee_enabled='0'` from the era when the
  overlay was integrity-hidden and toggling it looked useless. Since any
  "off" stored before the overlay worked cannot be an informed choice, the
  editor clears it once (flagged so it runs a single time); opt-outs from
  here on stick.

## 2026-08-03 — The rare-word list must be correctable

- Creator, after "won't" was treated as rare: "i must be able to add words
  such as 'won't' to the list of words which are not actually rare." The
  frequency ranks come from the top ~30k of Peter Norvig's Google Web
  Trillion Word Corpus counts; that corpus lost apostrophes, so
  contractions are unranked and the obscure detector counted them as rare.
  Two corrections shipped: a persistent per-browser not-rare list (panel
  button on obscure rows; marked words are treated as maximally common),
  and an automatic rank fallback to the apostrophe-stripped form
  (won't → wont).

## 2026-08-03 — URLs are not prose

- Creator, on markdown links: "link format is like: [text of link](url)
  right? i think anything within this kind of url area probably ought not
  be considered a thing which we spell check against, right?" The `(url)`
  part of markdown links and images, and bare URLs, are excluded from all
  rules via the existing exclusion-zone mechanism in host configuration;
  the link text in brackets stays checked. (Agent's note: this is host
  config, not a library change — exclusion zones were built for exactly
  this kind of non-prose span.)

## 2026-08-05 — README gets a screenshot

- Creator directed that their latest screenshot be included in README.md
  "for explaining what this thing is all about." The image (a text box with
  block highlights and the corrections panel beside it) now sits between
  the intro and "What it does" as `docs/screenshot.png`. (Agent's note: the
  alt text was written by the agent and shown to the creator with the
  change for approval, per the public-text rule.)

## 2026-08-05 — Creator rewrote the README intro

- The creator rewrote the README's opening directly: the product is now
  introduced as "A personal and customizable spellchecker", "inspired by an
  author's personal tools to improve his writing", with the spellchecking
  comparison now against "the default ff, windows, etc. checkers." No
  reasons stated. This supersedes the 2026-08-02 positioning directive that
  kept the Google/Apple challenge in the description.

## 2026-08-05 — Internal project name

- Creator: "rename the project internally to McPhee-personal-spellchecker."
  No reason stated. The user-facing product name in README.md remains
  "McPhee". (Agent's scoping, not the creator's: the rename covers the
  package name — lowercased to `mcphee-personal-spellchecker` because npm
  requires lowercase — and the project-index doc; it deliberately does not
  touch the `McPhee` global, the `mcphee-` CSS prefix, or the `mcphee_*`
  storage keys, since renaming storage keys would orphan the creator's
  personal dictionary and settings, and those identifiers are API surface
  rather than the project's name.)

## 2026-08-09 — Mini-phrase repetition must not be curated-only

- Repeated nearby mini-phrases or grammatical patterns, such as two uses of
  "at all", should be detected. The creator rejected limiting this detection
  to a curated phrase list: "that doesn't seem broad or safe enough." The
  design therefore needs general detection rather than coverage determined
  only by phrases selected in advance.
- The creator then directed: "let's just do full phrasal repetition
  detection." Implemented as general exact multi-word sequence discovery
  under the existing nearby-echo rule, with no curated allowlist.

## 2026-08-13 — Do not mark the word currently being typed

- Creator: "the word I'm typing myself at this very moment shall not show
  up as misspelled please." While the caret is inside a word, or at either
  edge of it, that word is not shown as misspelled (nor as unknown,
  culture, or a capitalization nag). The mark and the panel row appear
  once the caret leaves the word. Form guards still see the word — hiding
  it is display-only, so a typo in the last word still blocks submit.
  (Agent: this is the usual in-progress-token rule used by word processors;
  a caret in the space after a word has left it.)

## 2026-08-13 — Control tap corrects the nearest misspelling behind the caret

- Creator: tapping Control with no other key "attempt[s] to just do the
  most naive correction on the nearest misspelled word to my cursor going
  backwards only"; look backward until any misspelling is found and
  correct it based on the best guess; Ctrl+Z undoes that change; a further
  Control tap does the same for the prior one.
- Implemented as a Control-only tap (any other key in the chord cancels
  it, so Ctrl+Z / Ctrl+C / Ctrl+Enter keep their meaning). The replacement
  is a single occurrence, through the undo-preserving edit path, so Ctrl+Z
  reverts just that guess. The next tap then sees the previous misspelling
  as nearest. "Naive" means: use the confident pick when there is one,
  otherwise the top dictionary suggestion; words with no guess are skipped
  and the search continues backward.

## 2026-08-13 — First suggestion buttons share a vertical line

- Creator: "slightly move all the spelling checks right-ish so that they're
  all aligned with each other in a vertical line? I mean just the first
  one if ther are multiple options." The first suggestion (or cased-fix)
  button of every spelling row lines up; later suggestions on the same
  row still follow it.

## 2026-08-13 — Space-boundary typos ("i fi" → "if I")

- Creator, asking what would happen and whether algorithms exist: typing
  something like "i fi", which could be "if I", "would be really nice to
  be able to autocorrect." Then: treat "fi" (not a word) as a spelling
  issue whose fix "clean[s] up the local region"; go ahead with the
  method laid out (concatenate previous token + misspelling, try every
  single-space placement and join, keep unique distance-1 dictionary-word
  readings). Implemented: the misspelling is still "fi"; Control-tap,
  localFix, and the panel's first suggestion rewrite the pair to "if I"
  rather than guessing "fi"→"if" and leaving "i if". Standalone "i" in
  that rewrite is capitalized as the pronoun.
- Agent: only a single space between the previous token and the
  misspelling participates; if more than one distance-1 reading exists the
  region rewrite is refused and the single-word guess stands.

## 2026-08-13 — README names the web add-on; list it on AMO for anyone

- Creator: update the README to include the info on the new extension.
- Creator: upload the extension; the goal is that anyone can use it if it
  is published on AMO. (Agent: that is AMO's public/listed catalog, not
  an unlisted signed XPI. A listed first version goes through Mozilla
  review before it appears for everyone.)

## 2026-08-13 — Docked default, per-site memory, per-form +

- Creator: the default method of it appearing shall be **docked**. If the
  user changes it, remember what they left it set at for every site,
  separately.
- Creator, on multiple forms per page: it must be able to go to each.
  Add a little expando **+** to open, then click again to make it small
  on the side, for any form for which it's enabled.
- Creator asked whether "click to allow McPhee in this form" came from
  reason/laws, or was a choice. It was the creator's own product choice
  in the original directive ("only if allowed by you to see/know about
  it"). Not a legal requirement. (Firefox still has its own host-permission
  prompt to run on a page at all; that is separate from picking a form.)

## 2026-08-13 — personalide-spelling-mcphee: McPhee on forms you allow

- Creator, looking at a Firefox reply composer that still offered to submit
  despite egregious typos and with nobody warning: make a new Firefox
  extension named **personalide-spelling-mcphee**. It lets you configure it
  to certain form inputs on certain sites. Only if you allow it to
  see/know about a form does it apply the regular McPhee spellcheck to
  that form, with no other changes. It merely adds either an in-form or
  side-of-window sidebar which shows the choices to fix, and also does
  the traditional highlighting.
- No further reasons stated. The motivating case is a site composer that
  neither underlines mistakes nor refuses submit.
- Agent: this is a separate add-on from McPhee Guard. Guard blocks
  submit; this one checks and highlights, and does not change submit.
  Field text is unread until that field is allowed. On a site that is
  not a native textarea, the panel defaults to the side-of-window
  sidebar so the host layout is not rewritten; inline docking stays
  available where wrapping the field is safe. Highlighting on
  contenteditable composers uses the same mark colors, placed from
  live text ranges — the textarea mirror overlay cannot see inside
  those editors; if a range cannot be proven to match the analyzed
  word, highlighting hides rather than guess. Shared personal
  dictionary with Guard in this browser. Local debug install first;
  no store push until the creator tests it.

## 2026-08-13 — "personalide" is a misspelling of "personalize"

- Creator: the misspelling of "personalize" is spreading; contain and
  fix it immediately. The add-on name is **personalize-spelling-mcphee**
  (folder, gecko id, AMO slug, user-visible title). The misspelled AMO
  listing had been nominated for review and was not yet public; it was
  deleted so it cannot be approved under the typo.

## 2026-08-13 — GitHub README should show the add-on, with screenshots

- Creator: GitHub still showed nothing about the extension; they want
  that on the repo too, with screenshots. (Agent: origin still had the
  previous README because the add-on bullet had not been pushed. Alt
  text on the new images is the agent's, shown with this change.)

## 2026-08-13 — README opens with the browser add-on in action

- Creator, after a proposed ridge photograph under the title: "good but
  please use the most recent image" from their screenshots, "which i
  believe shows the browser version in action." That screenshot (McPhee
  docked beside a page, issues panel listing spelling and repeated
  phrases) now sits under the title as `docs/browser.png`. The earlier
  product screenshot and the two add-on shots stay where they were.
  (Agent: alt text is the agent's, shown with this change.)

## 2026-08-13 — Use the screenshot the creator gave

- Creator: "yes, we should be using the screenshot i gave you." The
  add-on on GitHub is illustrated by that image (`docs/browser.png`),
  not the agent-captured stand-ins. Those two files are removed.

## 2026-08-13 — GitHub README shows the x.com draft, not the test page

- Creator, looking at https://github.com/ernop/mcphee: do not show the
  test page. Show the recent image from their screenshots of typing a
  draft post on x.com and seeing the suggestions.

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
