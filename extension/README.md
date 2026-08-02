# McPhee Guard (Firefox extension)

Blocks submit buttons you have taught it while the text next to them contains
misspelled words. Built for sites where a typo cannot be fixed after posting
(x.com and friends). Guards are per browser profile; the personal dictionary
is shared across every site in that profile.

## Build

The extension must be self-contained, so copy the library and dictionaries in
first:

```powershell
.\build.ps1
```

## Load (temporary, for development)

1. Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Pick `extension/manifest.json`.
3. The add-on lasts until Firefox restarts; reload it there after changes.

For a permanent install: Firefox Developer Edition or ESR, set
`xpinstall.signatures.required=false` in `about:config`, zip the extension
folder contents, and open the zip — or sign it through
[addons.mozilla.org](https://addons.mozilla.org) (unlisted self-distribution).

## Teach a guard

1. Open the site (e.g. x.com), write nothing yet.
2. Click the McPhee Guard toolbar icon → **Teach a guard on this page**.
3. Step 1: click the text box you write in (the composer).
4. Step 2: click the submit/post button.

Done — saved for that origin in this browser. From then on, clicking that
button (or pressing Ctrl/Cmd+Enter in the field) with misspelled words in the
text is blocked in the capture phase before the page sees the event, and a
toast lists the words with `+ dict` buttons.

## Escape hatch

Nothing holds you hostage: submit the *unchanged* text again within 6 seconds
and it goes through. Editing the text resets the window.

## Notes

- Selectors prefer `data-testid`/`id`/`aria-label` and are resolved at click
  time, so SPA re-renders don't break guards.
- The ~700 KB dictionary loads only on origins that have guards (or during
  teaching); everywhere else the content script is a few KB and idle.
- Checking uses the `casual` profile: only genuinely misspelled words block;
  capitalization, punctuation, and repetition never do.
- Manage guards (list/remove) and the global on/off switch from the popup.
