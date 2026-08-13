# personalide-spelling-mcphee

A Firefox add-on that puts McPhee on form inputs you have allowed — and
on no others.

Motivating case: a reply composer in Firefox with egregious typos, no
warning at all, and still offering to submit.

## What it does

- You choose **certain form inputs on certain sites**. McPhee is not
  watching the web. It may see and know about a form only after you
  allow that form.
- Once you opt in, that form gets the **regular McPhee spellcheck** —
  the same checks, the same one-click fixes, the same personal
  dictionary. Nothing else about the site changes. Submit is not
  blocked; this is not the Guard add-on.
- It docks beside the form you allowed (the default). A little **+** on
  that form's side opens the suggestions; click again to make it small
  on the side. Several allowed forms on one page each have their own
  **+**. You can switch that site to a side-of-window sidebar instead;
  McPhee remembers the choice per site.
- It does McPhee's **traditional highlighting** on the words in the form.

Allow a form from the toolbar icon on that page. Remove an allowed form
the same way. A global off switch stops checking everywhere without
forgetting which forms you allowed.

The personal dictionary is the same one Guard uses in this browser: a
word you add in either add-on is known to both.

## Toolbar and on-page wording

These strings are the creator's product language, used as the add-on's
visible text:

- Add-on name: `personalide-spelling-mcphee`
- Allow a form: **Allow McPhee on a form on this page**
- While choosing: **Click the form input McPhee may see (Esc cancels)**
- After allowing: **Allowed — McPhee will check this form.**
- Empty list: **No forms on this page are allowed yet.**
- Privacy line: **Only forms you allow are seen or checked. Nothing else changes.**
- Global switch: **Enabled**
