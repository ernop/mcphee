var api = typeof browser !== "undefined" ? browser : chrome;

var activeTabId = null;

function restrictedUrl(url) {
  return /^(about:|chrome:|moz-extension:|resource:)/.test(url || "");
}

function renderTargets(state) {
  var box = document.getElementById("targets");
  box.innerHTML = "";
  document.getElementById("origin").textContent = state.targets.length
    ? state.targets.length + " allowed form" + (state.targets.length === 1 ? "" : "s") + " on " + state.origin
    : "No forms on this page are allowed yet.";
  state.targets.forEach(function (target, index) {
    var row = document.createElement("div");
    row.className = "row";
    var sel = document.createElement("span");
    sel.className = "sel";
    sel.title = target.field;
    sel.textContent = target.note || target.field;
    var del = document.createElement("button");
    del.textContent = "remove";
    del.addEventListener("click", function () {
      ensureTab().then(function () {
        return api.tabs.sendMessage(activeTabId, { type: "mcphee-spelling-remove", index: index });
      }).then(function (result) {
        renderTargets({ origin: state.origin, targets: result.targets });
      });
    });
    row.append(sel, del);
    box.appendChild(row);
  });
}

function ensureTab() {
  return api.runtime.sendMessage({ type: "mcphee-spelling-ensure", tabId: activeTabId }).then(function (r) {
    if (!r || !r.ok) throw new Error(r && r.error ? r.error : "no content script");
    return r;
  });
}

function loadState() {
  return ensureTab().then(function () {
    return api.tabs.sendMessage(activeTabId, { type: "mcphee-spelling-state" });
  }).then(renderTargets);
}

api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
  if (!tabs.length) return;
  activeTabId = tabs[0].id;
  var url = tabs[0].url || "";
  if (restrictedUrl(url)) {
    document.getElementById("origin").textContent =
      "Open the page you write on (not this browser page), then click Allow personalized-spelling on a form on this page.";
    document.getElementById("teach").disabled = true;
    return;
  }
  if (api.permissions && api.permissions.contains) {
    api.permissions.contains({ origins: ["<all_urls>"] }).then(function (have) {
      if (!have && api.permissions.request) {
        return api.permissions.request({ origins: ["<all_urls>"] });
      }
    }).catch(function () { /* popup still works on this tab via activeTab */ });
  }
  loadState().catch(function () {
    document.getElementById("origin").textContent =
      "Click Allow personalized-spelling on a form on this page, then click the box you write in.";
  });
});

document.getElementById("teach").addEventListener("click", function () {
  ensureTab()
    .then(function () {
      return api.tabs.sendMessage(activeTabId, { type: "mcphee-spelling-teach" });
    })
    .then(function () { window.close(); })
    .catch(function () {
      document.getElementById("origin").textContent =
        "Reload this page, then click Allow personalized-spelling on a form on this page.";
    });
});

api.storage.local.get(["mcphee_spelling_enabled", "mcphee_dict"]).then(function (data) {
  document.getElementById("enabled").checked = data.mcphee_spelling_enabled !== false;
  document.getElementById("dict").textContent =
    "Personal dictionary: " + (data.mcphee_dict || []).length + " words (shared with Guard in this browser).";
});

document.getElementById("enabled").addEventListener("change", function (event) {
  api.storage.local.set({ mcphee_spelling_enabled: event.target.checked });
});
