// McPhee Guard content script. Tiny until needed: the ~700 KB dictionary is
// fetched only on origins where a guard exists (or while teaching one).
//
// A guard is a taught pair of CSS selectors — the editable you write in and
// the button that sends it. Selectors are resolved at event time, never bound
// to elements, so SPA re-renders (x.com recreates its DOM constantly) cannot
// stale them. Blocking happens in the capture phase at document level with
// stopImmediatePropagation, before the page's own handlers run.
(function () {
  "use strict";

  var api = typeof browser !== "undefined" ? browser : chrome;
  var origin = location.origin;

  var checker = null;
  var checkerLoading = null;
  var guards = [];          // rules for this origin: { field, button, note }
  var enabled = true;
  var lastBlock = { sig: null, at: 0 };
  var OVERRIDE_MS = 6000;

  // ---------- storage ----------

  function loadState() {
    return api.storage.local.get(["mcphee_guards", "mcphee_enabled"]).then(function (data) {
      var all = data.mcphee_guards || {};
      guards = all[origin] || [];
      enabled = data.mcphee_enabled !== false;
      if (guards.length && enabled) ensureChecker();
    });
  }

  function saveGuards() {
    return api.storage.local.get("mcphee_guards").then(function (data) {
      var all = data.mcphee_guards || {};
      if (guards.length) all[origin] = guards;
      else delete all[origin];
      return api.storage.local.set({ mcphee_guards: all });
    });
  }

  // The personal dictionary lives in extension storage (per browser profile,
  // shared across every site) — NOT page localStorage, which is per-origin
  // and belongs to the page. saveCustomDict is repointed after create().
  function ensureChecker() {
    if (checker) return Promise.resolve(checker);
    if (checkerLoading) return checkerLoading;
    checkerLoading = Promise.all([
      McPhee.create({
        affUrl: api.runtime.getURL("vendor/typo/en_US.aff"),
        dicUrl: api.runtime.getURL("vendor/typo/en_US.dic"),
        profile: "casual",
        customDictStorageKey: "__mcphee_guard_unused__",
      }),
      api.storage.local.get("mcphee_dict"),
    ]).then(function (results) {
      checker = results[0];
      checker.customWords = new Set((results[1].mcphee_dict || []).map(function (w) {
        return String(w).toLowerCase();
      }));
      checker.saveCustomDict = function () {
        api.storage.local.set({ mcphee_dict: Array.from(checker.customWords).sort() });
      };
      return checker;
    });
    return checkerLoading;
  }

  // ---------- gating ----------

  function fieldText(field) {
    if (typeof field.value === "string" && field.tagName !== "DIV") return field.value;
    return field.innerText || "";
  }

  // @handles, #hashtags, and URLs are not prose; mask them (offset-preserving)
  // so their fragments can't false-block a post.
  function maskNonProse(text) {
    var mask = function (s) { return " ".repeat(s.length); };
    return text
      .replace(/\bhttps?:\/\/\S+/gi, mask)
      .replace(/\b[\w-]+(?:\.[\w-]+)+(?:\/\S*)?/g, mask)   // bare domains/paths
      .replace(/[@#][\w']+/g, mask);
  }

  function misspellings(text) {
    return checker.analyze(maskNonProse(text), { profile: "casual" }).filter(function (issue) {
      return issue.classification === "misspelled";
    });
  }

  // Returns true when the event was blocked.
  function checkGuard(rule, event) {
    if (!checker) { ensureChecker(); return false; } // dictionary still loading: let it pass
    var field = document.querySelector(rule.field);
    if (!field) return false;
    var text = fieldText(field);
    if (!text.trim()) return false;
    var issues = misspellings(text);
    if (!issues.length) return false;
    var sig = rule.field + "\u0000" + text;
    if (lastBlock.sig === sig && Date.now() - lastBlock.at < OVERRIDE_MS) {
      return false; // deliberate resubmit of unchanged text — escape hatch
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    lastBlock = { sig: sig, at: Date.now() };
    showToast(issues);
    return true;
  }

  function onClick(event) {
    if (teach.active) { onTeachClick(event); return; }
    if (!enabled || !guards.length) return;
    if (!event.target || !event.target.closest) return;
    for (var i = 0; i < guards.length; i++) {
      if (event.target.closest(guards[i].button)) {
        if (checkGuard(guards[i], event)) return;
      }
    }
  }

  function onKeydown(event) {
    if (teach.active) {
      if (event.key === "Escape") endTeach("Teaching cancelled.");
      return;
    }
    if (!enabled || !guards.length) return;
    // Ctrl/Cmd+Enter is the keyboard submit on x.com and most composers.
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    if (!event.target || !event.target.closest) return;
    for (var i = 0; i < guards.length; i++) {
      if (event.target.closest(guards[i].field)) {
        if (checkGuard(guards[i], event)) return;
      }
    }
  }

  // ---------- toast ----------

  var toastEl = null;
  var toastTimer = null;

  function showToast(issues) {
    removeToast();
    var seen = new Set();
    var words = [];
    issues.forEach(function (issue) {
      var w = issue.value.toLowerCase();
      if (!seen.has(w)) { seen.add(w); words.push(issue.value); }
    });

    toastEl = document.createElement("div");
    toastEl.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:340px;" +
      "background:#1f2430;color:#f5f5f5;border:2px solid #e5484d;border-radius:8px;" +
      "padding:12px 14px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);";

    var head = document.createElement("div");
    head.style.cssText = "font-weight:600;margin-bottom:6px;";
    head.textContent = "McPhee blocked this — " + words.length +
      " misspelled word" + (words.length === 1 ? "" : "s");
    toastEl.appendChild(head);

    words.slice(0, 8).forEach(function (word) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:2px 0;";
      var name = document.createElement("span");
      name.style.cssText = "flex:1;color:#ff9a9e;font-family:ui-monospace,monospace;";
      name.textContent = word;
      var add = document.createElement("button");
      add.type = "button";
      add.textContent = "+ dict";
      add.style.cssText = "cursor:pointer;font:12px system-ui;padding:1px 8px;border-radius:4px;" +
        "border:1px solid #666;background:#2c3242;color:#f5f5f5;";
      add.addEventListener("click", function (ev) {
        ev.stopPropagation();
        checker.addCustomWord(word);
        row.remove();
      });
      row.append(name, add);
      toastEl.appendChild(row);
    });

    var foot = document.createElement("div");
    foot.style.cssText = "margin-top:6px;color:#aab;font-size:12px;";
    foot.textContent = "Fix them, add to dictionary, or submit the unchanged text again within 6 s to send anyway.";
    toastEl.appendChild(foot);

    document.documentElement.appendChild(toastEl);
    toastTimer = setTimeout(removeToast, 8000);
  }

  function removeToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) { toastEl.remove(); toastEl = null; }
  }

  // ---------- teaching ----------

  var teach = { active: false, step: 0, fieldSelector: null, hovered: null, prevOutline: "" };
  var bannerEl = null;

  function banner(text) {
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
        "background:#1f2430;color:#f5f5f5;border:2px solid #4a90d9;border-radius:8px;" +
        "padding:10px 18px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);";
      document.documentElement.appendChild(bannerEl);
    }
    bannerEl.textContent = text;
  }

  function removeBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
  }

  function startTeach() {
    teach = { active: true, step: 1, fieldSelector: null, hovered: null, prevOutline: "" };
    banner("McPhee — step 1 of 2: click the text box you write in (Esc cancels)");
    document.addEventListener("mouseover", onTeachHover, true);
  }

  function endTeach(message) {
    clearHover();
    document.removeEventListener("mouseover", onTeachHover, true);
    teach.active = false;
    if (message) {
      banner(message);
      setTimeout(removeBanner, 3000);
    } else {
      removeBanner();
    }
  }

  function onTeachHover(event) {
    clearHover();
    var el = event.target;
    if (!el || el === bannerEl) return;
    teach.hovered = el;
    teach.prevOutline = el.style.outline;
    el.style.outline = "3px solid #4a90d9";
  }

  function clearHover() {
    if (teach.hovered) {
      teach.hovered.style.outline = teach.prevOutline;
      teach.hovered = null;
    }
  }

  var EDITABLE_SEL = 'textarea, input[type="text"], input:not([type]), ' +
    '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]';
  var BUTTONISH_SEL = 'button, input[type="submit"], input[type="button"], [role="button"], a';

  function onTeachClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    clearHover();
    var target = event.target;
    if (teach.step === 1) {
      var field = target.closest(EDITABLE_SEL);
      if (!field) { banner("That doesn't look editable — click the text box you write in (Esc cancels)"); return; }
      teach.fieldSelector = selectorFor(field);
      teach.step = 2;
      banner("McPhee — step 2 of 2: now click the submit / post button");
    } else if (teach.step === 2) {
      var button = target.closest(BUTTONISH_SEL) || target;
      guards.push({
        field: teach.fieldSelector,
        button: selectorFor(button),
        note: (document.title || origin).slice(0, 60),
        created: Date.now(),
      });
      saveGuards();
      ensureChecker();
      endTeach("Guard saved — this button now refuses misspelled text.");
    }
  }

  // Stable-attribute-first selector generation. data-testid is preferred
  // because SPAs (x.com included) keep it stable across DOM re-renders while
  // ids and classes churn.
  function selectorFor(el) {
    var candidates = [];
    var tag = el.tagName.toLowerCase();
    if (el.getAttribute("data-testid")) {
      candidates.push('[data-testid="' + cssEscape(el.getAttribute("data-testid")) + '"]');
    }
    if (el.id) candidates.push("#" + cssEscape(el.id));
    if (el.getAttribute("name")) candidates.push(tag + '[name="' + cssEscape(el.getAttribute("name")) + '"]');
    if (el.getAttribute("aria-label")) candidates.push(tag + '[aria-label="' + cssEscape(el.getAttribute("aria-label")) + '"]');
    if (el.getAttribute("placeholder")) candidates.push(tag + '[placeholder="' + cssEscape(el.getAttribute("placeholder")) + '"]');
    for (var i = 0; i < candidates.length; i++) {
      if (matchesUniquely(candidates[i], el)) return candidates[i];
    }
    return structuralPath(el);
  }

  function cssEscape(value) {
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function matchesUniquely(selector, el) {
    try {
      var found = document.querySelectorAll(selector);
      return found.length === 1 && found[0] === el;
    } catch (e) {
      return false;
    }
  }

  function structuralPath(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 6 && node !== document.body) {
      var tag = node.tagName.toLowerCase();
      var index = 1;
      var sib = node;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === node.tagName) index++;
      }
      parts.unshift(tag + ":nth-of-type(" + index + ")");
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // ---------- wiring ----------

  api.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message && message.type === "mcphee-teach") {
      startTeach();
      sendResponse({ ok: true });
    } else if (message && message.type === "mcphee-state") {
      sendResponse({ origin: origin, guards: guards, enabled: enabled });
    } else if (message && message.type === "mcphee-remove-guard") {
      guards.splice(message.index, 1);
      saveGuards();
      sendResponse({ ok: true, guards: guards });
    }
    return false;
  });

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.mcphee_enabled) enabled = changes.mcphee_enabled.newValue !== false;
    if (changes.mcphee_guards) {
      guards = (changes.mcphee_guards.newValue || {})[origin] || [];
      if (guards.length && enabled) ensureChecker();
    }
    if (changes.mcphee_dict && checker) {
      checker.customWords = new Set((changes.mcphee_dict.newValue || []).map(function (w) {
        return String(w).toLowerCase();
      }));
    }
  });

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown, true);

  loadState();
})();
