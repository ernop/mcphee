# personalized-spelling (Firefox)

Puts personalized-spelling on form inputs you have allowed. Product description:
[docs/personalize-spelling-mcphee.md](../docs/personalize-spelling-mcphee.md).

This add-on does not block submit. That is the Guard (`extension/`).

## Build (required before first load)

The add-on must be self-contained, so copy the library and dictionaries in:

```sh
./personalize-spelling-mcphee/build.sh
```

## Load (temporary, for development)

1. Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Pick `personalize-spelling-mcphee/manifest.json`.
3. Reload the add-on there after any change (this add-on lasts until Firefox restarts).

The toolbar icon is often hidden behind Firefox's puzzle-piece button. Open that menu, find **personalized-spelling**, and pin it.

If Firefox asks whether the add-on may access data for all websites, allow it — otherwise it cannot see the page you are on.

A local test page with a textarea and an x.com-shaped contenteditable
composer is `testbed.html`. Serve the repo (`python3 -m http.server` from
the repo root) and open `/personalize-spelling-mcphee/testbed.html`.

## Allow a form (this is what makes it active)

Nothing happens in a text box until you allow that box:

1. Open the site (or the testbed).
2. Click the **personalized-spelling** toolbar icon.
3. Click **Allow personalized-spelling on a form on this page**.
4. Click the text box you write in. A banner at the top of the page confirms it.

The suggestions panel **docks beside that form** (default). A **+** on the
form's side opens it; click again to shrink it to the small control.
Allow several boxes on one page — each gets its own **+**. Switching
that site to a side-of-window drawer is remembered per site.

Field text is unread until that field is allowed. Dictionary files load
only after this origin has at least one allowed field.

The personal dictionary is `mcphee_dict` in extension storage — the same
list Guard uses in this browser.

## Notes

- Selectors prefer `data-testid` / `id` / `aria-label` and are resolved
  when the box appears, so SPA re-renders (a reply modal opening) pick it
  up.
- @handles, #hashtags, and URLs are exclusion zones, same idea as Guard.
- If a contenteditable highlight cannot be proven to sit on the analyzed
  word, highlighting hides (fail closed). The suggestions sidebar still
  lists the issues.
- Listed on addons.mozilla.org (public catalog). Version 0.2.1 is in
  Mozilla review; after approval anyone can install it from
  https://addons.mozilla.org/firefox/addon/personalized-spelling/
  Developer status:
  https://addons.mozilla.org/en-US/developers/addon/personalized-spelling/versions/6413293
