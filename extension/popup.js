var api = typeof browser !== "undefined" ? browser : chrome;

var activeTabId = null;

function renderGuards(state) {
  var box = document.getElementById("guards");
  box.innerHTML = "";
  document.getElementById("origin").textContent = state.guards.length
    ? state.guards.length + " guard" + (state.guards.length === 1 ? "" : "s") + " on " + state.origin
    : "No guards on " + state.origin + " yet.";
  state.guards.forEach(function (guard, index) {
    var row = document.createElement("div");
    row.className = "row";
    var sel = document.createElement("span");
    sel.className = "sel";
    sel.title = guard.field + "  →  " + guard.button;
    sel.textContent = guard.button;
    var del = document.createElement("button");
    del.textContent = "remove";
    del.addEventListener("click", function () {
      api.tabs.sendMessage(activeTabId, { type: "mcphee-remove-guard", index: index })
        .then(function (result) { renderGuards({ origin: state.origin, guards: result.guards }); });
    });
    row.append(sel, del);
    box.appendChild(row);
  });
}

api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
  if (!tabs.length) return;
  activeTabId = tabs[0].id;
  api.tabs.sendMessage(activeTabId, { type: "mcphee-state" }).then(renderGuards).catch(function () {
    document.getElementById("origin").textContent =
      "McPhee can't run on this page (browser-internal or restricted URL).";
    document.getElementById("teach").disabled = true;
  });
});

document.getElementById("teach").addEventListener("click", function () {
  api.tabs.sendMessage(activeTabId, { type: "mcphee-teach" }).then(function () { window.close(); });
});

api.storage.local.get(["mcphee_enabled", "mcphee_dict"]).then(function (data) {
  document.getElementById("enabled").checked = data.mcphee_enabled !== false;
  document.getElementById("dict").textContent =
    "Personal dictionary: " + (data.mcphee_dict || []).length + " words (shared across sites in this browser).";
});

document.getElementById("enabled").addEventListener("change", function (event) {
  api.storage.local.set({ mcphee_enabled: event.target.checked });
});
