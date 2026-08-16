// personalize-spelling-mcphee content script.
// Field text is unread until that field has been allowed. Dictionary files
// are fetched only after at least one allowed field exists on this origin.
(function () {
  "use strict";

  if (window.__mcpheeSpellingLoaded) return;
  window.__mcpheeSpellingLoaded = true;

  var api = typeof browser !== "undefined" ? browser : chrome;
  var origin = location.origin;
  var Editable = window.McPheeEditable;

  var checker = null;
  var checkerLoading = null;
  var targets = [];
  var enabled = true;
  var mounts = [];
  var mounting = {};
  var observer = null;
  var ui = { mode: "inline", collapsed: {} };
  var posBound = false;

  var EDITABLE_SEL = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]';

  function normalizeUi(raw) {
    var next = raw && typeof raw === "object" ? raw : {};
    return {
      mode: next.mode === "drawer" ? "drawer" : "inline",
      collapsed: next.collapsed && typeof next.collapsed === "object" ? next.collapsed : {},
    };
  }

  function loadState() {
    return api.storage.local.get([
      "mcphee_spelling_targets",
      "mcphee_spelling_enabled",
      "mcphee_spelling_ui",
    ]).then(function (data) {
      var all = data.mcphee_spelling_targets || {};
      targets = all[origin] || [];
      enabled = data.mcphee_spelling_enabled !== false;
      ui = normalizeUi((data.mcphee_spelling_ui || {})[origin]);
      syncMounts();
    });
  }

  function saveUi() {
    return api.storage.local.get("mcphee_spelling_ui").then(function (data) {
      var all = data.mcphee_spelling_ui || {};
      all[origin] = ui;
      return api.storage.local.set({ mcphee_spelling_ui: all });
    });
  }

  function saveTargets() {
    return api.storage.local.get("mcphee_spelling_targets").then(function (data) {
      var all = data.mcphee_spelling_targets || {};
      if (targets.length) all[origin] = targets;
      else delete all[origin];
      return api.storage.local.set({ mcphee_spelling_targets: all });
    });
  }

  function ensureChecker() {
    if (checker) return Promise.resolve(checker);
    if (checkerLoading) return checkerLoading;
    checkerLoading = Promise.all([
      McPhee.create({
        affUrl: api.runtime.getURL("vendor/typo/en_US.aff"),
        dicUrl: api.runtime.getURL("vendor/typo/en_US.dic"),
        affUrl2026: api.runtime.getURL("vendor/typo/en_US_2026.aff"),
        dicUrl2026: api.runtime.getURL("vendor/typo/en_US_2026.dic"),
        freqUrl: api.runtime.getURL("vendor/wordfreq/en-30k.txt"),
        profile: "standard",
        customDictStorageKey: "__mcphee_spelling_unused__",
        exclude: [
          /\bhttps?:\/\/\S+/gi,
          /\b[\w-]+(?:\.[\w-]+)+(?:\/\S*)?/g,
          /[@#][\w']+/g,
        ],
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

  function detachAll() {
    mounts.slice().forEach(function (m) { m.detach(); });
    mounts = [];
  }

  function findMounted(selector) {
    for (var i = 0; i < mounts.length; i++) {
      if (mounts[i].selector === selector) return mounts[i];
    }
    return null;
  }

  function mountField(el, selector) {
    if (findMounted(selector) && findMounted(selector).el === el) return;
    if (mounting[selector]) return;
    var existing = findMounted(selector);
    if (existing) existing.detach();
    mounting[selector] = true;
    try {
      mountFieldBody(el, selector);
    } finally {
      delete mounting[selector];
    }
  }

  function positionAll() {
    mounts.forEach(function (m) { if (m.position) m.position(); });
  }

  function bindPosition() {
    if (posBound) return;
    posBound = true;
    window.addEventListener("scroll", positionAll, true);
    window.addEventListener("resize", positionAll);
  }

  function applyAllChrome() {
    mounts.forEach(function (m) { if (m.applyChrome) m.applyChrome(); });
  }

  function mountFieldBody(el, selector) {
    var textareaLike = Editable.isTextareaLike(el);
    var field = textareaLike ? el : Editable.adapt(el);
    var controller = textareaLike
      ? checker.attach(field, { profile: "standard" })
      : Editable.attachRangeOverlay(field, checker, { profile: "standard" });

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mcphee-ext-toggle";

    var panelWrap = document.createElement("div");
    panelWrap.className = "mcphee-ext-dock";

    var chrome = document.createElement("div");
    chrome.className = "mcphee-dock-bar";
    var modeBtn = document.createElement("button");
    modeBtn.type = "button";
    modeBtn.className = "mcphee-panel-btn mcphee-dock-modebtn";
    chrome.appendChild(modeBtn);
    panelWrap.appendChild(chrome);

    var panelContainer = document.createElement("div");
    panelWrap.appendChild(panelContainer);

    document.documentElement.appendChild(toggle);
    document.documentElement.appendChild(panelWrap);

    var panel = checker.attachPanel({
      textarea: field,
      container: panelContainer,
      controller: controller,
      profile: "standard",
    });

    function isCollapsed() {
      return !!ui.collapsed[selector];
    }

    function position() {
      if (!field.isConnected) return;
      var r = field.getBoundingClientRect();
      var off = r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight;
      toggle.style.visibility = off ? "hidden" : "visible";
      toggle.style.left = Math.min(window.innerWidth - 26, Math.max(0, r.right + 4)) + "px";
      toggle.style.top = Math.min(window.innerHeight - 26, Math.max(0, r.top)) + "px";
      if (off || isCollapsed() || ui.mode !== "inline") return;
      var gap = 28;
      var w = 340;
      var left = r.right + gap;
      if (left + w > window.innerWidth - 8) left = r.left - gap - w;
      if (left < 8) left = Math.max(8, window.innerWidth - w - 8);
      panelWrap.style.left = left + "px";
      panelWrap.style.top = Math.max(8, Math.min(r.top, window.innerHeight - 80)) + "px";
      panelWrap.style.height = Math.min(Math.max(r.height, 240), window.innerHeight - 16) + "px";
      panelWrap.style.width = w + "px";
    }

    function applyChrome() {
      var open = !isCollapsed();
      toggle.textContent = open ? "\u2212" : "+";
      modeBtn.textContent = ui.mode === "inline" ? "\u21e5 side drawer" : "\u21e4 dock inline";
      panelWrap.className = "mcphee-ext-dock";
      panelWrap.style.left = "";
      panelWrap.style.top = "";
      panelWrap.style.height = "";
      panelWrap.style.width = "";
      if (ui.mode === "drawer") {
        panelWrap.classList.add("mcphee-drawer");
        if (open) panelWrap.classList.add("mcphee-drawer-open");
      } else if (open) {
        panelWrap.classList.add("mcphee-ext-dock-open");
      }
      position();
    }

    toggle.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var willOpen = isCollapsed();
      if (willOpen && ui.mode === "drawer") {
        mounts.forEach(function (m) {
          if (m.selector !== selector) ui.collapsed[m.selector] = true;
        });
      }
      ui.collapsed[selector] = !willOpen;
      saveUi();
      applyAllChrome();
    });

    modeBtn.addEventListener("click", function () {
      ui.mode = ui.mode === "inline" ? "drawer" : "inline";
      saveUi();
      applyAllChrome();
    });

    bindPosition();
    applyChrome();

    var resizeObserver = new ResizeObserver(position);
    resizeObserver.observe(field);

    var mount = {
      selector: selector,
      el: el,
      position: position,
      applyChrome: applyChrome,
      refresh: function () {
        controller.refresh(true);
        panel.refresh();
      },
      detach: function () {
        resizeObserver.disconnect();
        panel.detach();
        controller.detach();
        toggle.remove();
        panelWrap.remove();
        mounts = mounts.filter(function (m) { return m !== mount; });
      },
    };
    mounts.push(mount);
  }

  function syncMounts() {
    if (!enabled || !targets.length) {
      detachAll();
      return;
    }
    ensureChecker().then(function () {
      if (!enabled) return;
      targets.forEach(function (rule) {
        var el = null;
        try { el = document.querySelector(rule.field); } catch (err) { el = null; }
        if (!el || !el.isConnected) {
          var mounted = findMounted(rule.field);
          if (mounted) mounted.detach();
          return;
        }
        var mounted = findMounted(rule.field);
        if (mounted && mounted.el === el) return;
        mountField(el, rule.field);
      });
      mounts.slice().forEach(function (m) {
        var still = targets.some(function (t) { return t.field === m.selector; });
        if (!still) m.detach();
      });
      if (bannerEl && mounts.length) {
        banner("Allowed — personalized-spelling will check this form.");
        setTimeout(removeBanner, 3000);
      }
    }).catch(function (err) {
      console.error("McPhee spelling:", err);
      banner("personalized-spelling could not start on this form.");
    });
  }

  function watchDom() {
    if (observer) return;
    var timer = null;
    observer = new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        if (targets.length && enabled) syncMounts();
      }, 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ---------- teaching ----------

  var teach = { active: false, hovered: null };
  var bannerEl = null;

  function banner(text) {
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.className = "mcphee-teach-banner";
      document.documentElement.appendChild(bannerEl);
    }
    bannerEl.textContent = text;
  }

  function removeBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
  }

  function startTeach() {
    teach = { active: true, hovered: null };
    banner("Click the form input personalized-spelling may see (Esc cancels)");
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
    el.classList.add("mcphee-teach-hover");
  }

  function clearHover() {
    if (teach.hovered) {
      teach.hovered.classList.remove("mcphee-teach-hover");
      teach.hovered = null;
    }
  }

  function onTeachClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    clearHover();
    var field = event.target && event.target.closest && event.target.closest(EDITABLE_SEL);
    if (!field || !Editable.isEditable(field)) {
      banner("That doesn't look like a form input — click the box you write in (Esc cancels)");
      return;
    }
    var selector = selectorFor(field);
    var already = targets.some(function (t) { return t.field === selector; });
    if (!already) {
      targets.push({
        field: selector,
        note: (document.title || origin).slice(0, 60),
        created: Date.now(),
      });
      saveTargets();
    }
    endTeach(null);
    banner("Allowed — loading personalized-spelling…");
    watchDom();
    syncMounts();
  }

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

  function onClick(event) {
    if (teach.active) onTeachClick(event);
  }

  function onKeydown(event) {
    if (teach.active && event.key === "Escape") endTeach("Cancelled.");
  }

  api.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message && message.type === "mcphee-spelling-ping") {
      sendResponse({ ok: true });
    } else if (message && message.type === "mcphee-spelling-teach") {
      startTeach();
      sendResponse({ ok: true });
    } else if (message && message.type === "mcphee-spelling-state") {
      sendResponse({ origin: origin, targets: targets, enabled: enabled });
    } else if (message && message.type === "mcphee-spelling-remove") {
      targets.splice(message.index, 1);
      saveTargets().then(function () {
        syncMounts();
        sendResponse({ ok: true, targets: targets });
      });
      return true;
    }
    return false;
  });

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.mcphee_spelling_enabled) {
      enabled = changes.mcphee_spelling_enabled.newValue !== false;
      syncMounts();
    }
    if (changes.mcphee_spelling_targets) {
      targets = (changes.mcphee_spelling_targets.newValue || {})[origin] || [];
      if (targets.length) watchDom();
      syncMounts();
    }
    if (changes.mcphee_spelling_ui) {
      ui = normalizeUi((changes.mcphee_spelling_ui.newValue || {})[origin]);
      applyAllChrome();
    }
    if (changes.mcphee_dict && checker) {
      checker.customWords = new Set((changes.mcphee_dict.newValue || []).map(function (w) {
        return String(w).toLowerCase();
      }));
      mounts.forEach(function (m) { if (m.refresh) m.refresh(); });
    }
  });

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown, true);

  loadState().then(function () {
    if (targets.length) watchDom();
  });
})();
