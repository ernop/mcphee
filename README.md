# personalized-spelling

![A draft post on x.com with personalized-spelling highlights in the text
and the suggestions panel beside it](docs/browser.png)

A personal and customizable spellchecker — and some other fun stuff:

inspired by an author's personal tools to improve his writing, it also:

- finds repeated obscure words within a text 
- catches mistaken reuse of the same word or phrase close together,
- does better spellchecking than the default ff, windows, etc. checkers.

## What it does

- **A corrections panel** beside your text: suggestions you click once to
  fix everywhere, an add-to-dictionary button, and an ignore button (with
  a brief undo, and a list to un-ignore later). Hovering an item highlights
  every matching word or phrase in your text — for a repetition, both uses
  at once; clicking one selects it. The word you are currently typing is
  not marked misspelled; it is checked once you leave it. Tap Control
  (nothing else) to apply the best guess to the nearest misspelling behind
  the caret; tap Control again for the one before that. A misspelling can
  be a letter that slipped across a space (i fi → if I); that is fixed as
  the local pair, not as the fragment alone. Fixes never destroy
  your undo history — Ctrl+Z always works, including to undo a Control-tap
  guess.
- **Repetition detection**, inspired by John McPhee, who ran Kedit's `All`
  command over every piece to see each use of a chosen word and the
  distances between occurrences (*Draft No. 4*, "Structure"):
  - a distinctive, obscure word used more than once in a piece — once is
    usually enough;
  - mistaken reuse of the same word or phrase close together — the
    accidental echo you stop seeing while editing.
  Repetition is never auto-fixed: choosing the replacement word is the
  author's job. The tool's job is finding the echo.
- **A concordance view**: every occurrence of any word with the gaps
  between them, plus an automatic report ranking which repeated words bunch
  suspiciously.
- **Proper nouns caught by omission**: if the dictionary rejects "jupiter"
  but knows "Jupiter", that's proof it's a proper noun written lowercase —
  one click capitalizes it. Same for "nasa" → NASA, "friday" → Friday,
  and uncapitalized nation, group, and language names ("japanese", "usa").
- **Formality levels**: casual (lowercase i, no periods, lowercase names —
  all fine), normal, and formal (full sentences, full rigamarole), switched
  with three always-visible buttons and remembered per site. A config
  panel adjusts every rule individually.
- **Sane space rules**: two spaces after a sentence are a style, not an
  error. Accidental space runs are flagged as one clean rectangle and
  collapse with one click.
- **A personal dictionary** that grows with you and stops the nagging
  permanently.
- **Exclusion zones**: each site can mark its markup — template blocks,
  code, whatever — as not-prose, and the checker treats it as not being
  there at all.
- **Verified highlighting**: the overlay checks its own accuracy after
  every change and hides itself rather than ever show a highlight in the
  wrong place.
- **A hard-blocking form guard** and a Firefox extension: teach it which
  submit buttons must refuse text containing misspellings — built for
  sites where a typo can't be fixed after posting. No override, no escape
  hatch; fix the word or add it to your dictionary.
- **A Firefox add-on for forms on the web** (personalized-spelling):
  you allow certain boxes on certain sites; only those get
  personalized-spelling — the same checks, the same one-click fixes, the
  same personal dictionary. It docks beside the form; a + opens the
  suggestions, and a second click shrinks it. Several allowed forms on one
  page each have their own +. You can switch a site to a side-of-window
  sidebar instead; that choice is remembered per site. This add-on does
  not block submit (that is the Guard). personalized-spelling is not
  watching the rest of the page.

## For the technically curious

Technical documentation is indexed in [AGENTS.md](AGENTS.md).
