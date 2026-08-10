# McPhee

A personal and customizable spellchecker — and some other fun stuff:

inspired by an author's personal tools to improve his writing, it also:

- finds repeated obscure words within a text 
- catches mistaken reuse of the same word or phrase close together,
- does better spellchecking than the default ff, windows, etc. checkers.

![A text box with McPhee's block highlights — pink on a misspelling, blue on
lowercased proper nouns — and the corrections panel below it, listing
one-click fixes, add-to-dictionary and ignore buttons, and repeated-word
notices with the distance between uses](docs/screenshot.png)

## What it does

- **A corrections panel** beside your text: suggestions you click once to
  fix everywhere, an add-to-dictionary button, and an ignore button (with
  a brief undo, and a list to un-ignore later). Hovering an item highlights
  every matching word or phrase in your text — for a repetition, both uses
  at once; clicking one selects it. Fixes never destroy
  your undo history — Ctrl+Z always works.
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

## For the technically curious

Technical documentation is indexed in [AGENTS.md](AGENTS.md).
