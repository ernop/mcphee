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

The block is hard. The only ways through are fixing the words or adding them
to the dictionary. If the dictionary is somehow still parsing when you click,
the guard fails closed (blocks and says so) rather than letting text through
unchecked. If a guard ever misbehaves, remove it or flip the global switch in
the popup.

## Test

`testbed.html` (serve the repo with any static server) is a fake x.com
composer with the real site's DOM shape — `contenteditable` with
`data-testid="tweetTextarea_0"`, JS-driven `tweetButton`, no form. Teach a
guard on it and verify a misspelled post never reaches the feed, by click or
by Ctrl/Cmd+Enter.

## Notes

- Selectors prefer `data-testid`/`id`/`aria-label` and are resolved at click
  time, so SPA re-renders don't break guards.
- On guarded origins the dictionary loads immediately at page load, ready
  before you can write a post. Unguarded origins load nothing — there is
  nothing to check there.
- Checking uses the `casual` profile: only genuinely misspelled words block;
  capitalization, punctuation, and repetition never do. @handles, #hashtags,
  and URLs are masked before analysis.
- Manage guards (list/remove) and the global on/off switch from the popup.
