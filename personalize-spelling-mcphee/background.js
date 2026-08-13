// Inject the content script into the tab the user just opened the popup on.
// Firefox MV3 does not run <all_urls> content scripts until host access is
// granted; clicking the toolbar grants activeTab, which is enough for that tab.
var api = typeof browser !== "undefined" ? browser : chrome;

var FILES_JS = ["vendor/typo/typo.min.js", "mcphee.js", "editable.js", "content.js"];
var FILES_CSS = ["mcphee.css", "page.css"];

function ping(tabId) {
  return api.tabs.sendMessage(tabId, { type: "mcphee-spelling-ping" }).then(function (r) {
    return !!(r && r.ok);
  }).catch(function () { return false; });
}

function inject(tabId) {
  return api.scripting.insertCSS({
    target: { tabId: tabId },
    files: FILES_CSS,
  }).catch(function () { /* already present */ }).then(function () {
    return api.scripting.executeScript({
      target: { tabId: tabId },
      files: FILES_JS,
    });
  });
}

function ensure(tabId) {
  return ping(tabId).then(function (ok) {
    if (ok) return { ok: true };
    return inject(tabId).then(function () {
      return new Promise(function (resolve) { setTimeout(resolve, 80); });
    }).then(function () { return ping(tabId); }).then(function (ok2) {
      if (!ok2) return { ok: false, error: "content script did not start" };
      return { ok: true };
    });
  });
}

api.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message && message.type === "mcphee-spelling-ensure") {
    ensure(message.tabId).then(sendResponse).catch(function (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    });
    return true;
  }
});
