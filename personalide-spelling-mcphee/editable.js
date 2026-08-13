// Contenteditable adapter for McPhee: a linear text + DOM-point map so
// analyze(), attachPanel, and range highlighting share one string.
// Textareas/inputs are left alone — they already have .value.
(function (global) {
  "use strict";

  var SKIP_RE = /[\u200B\u200C\u200D\uFEFF]/;
  var BLOCK_RE = /^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE|TR|SECTION|ARTICLE|HEADER|FOOTER|DT|DD|UL|OL)$/;

  function serialize(root) {
    var text = "";
    var points = [];

    function push(ch, node, offset) {
      text += ch;
      points.push({ node: node, offset: offset });
    }

    function walk(node) {
      if (node.nodeType === 3) {
        var v = node.nodeValue || "";
        for (var i = 0; i < v.length; i++) {
          if (SKIP_RE.test(v.charAt(i))) continue;
          push(v.charAt(i), node, i);
        }
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.nodeName === "BR") {
        push("\n", node, 0);
        return;
      }
      var children = node.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (
          i > 0 &&
          child.nodeType === 1 &&
          BLOCK_RE.test(child.nodeName) &&
          text.length &&
          text.charAt(text.length - 1) !== "\n"
        ) {
          push("\n", child, 0);
        }
        walk(child);
      }
    }

    walk(root);
    return { text: text, points: points };
  }

  function boundPoint(points, index, atEnd) {
    if (!points.length) return null;
    if (index < 0) index = 0;
    if (index >= points.length) {
      var last = points[points.length - 1];
      var extra = last.node.nodeType === 3 ? 1 : 0;
      return { node: last.node, offset: last.offset + extra };
    }
    if (atEnd && index > 0) {
      var prev = points[index - 1];
      var off = prev.node.nodeType === 3 ? prev.offset + 1 : 0;
      return { node: prev.node, offset: off };
    }
    return { node: points[index].node, offset: points[index].offset };
  }

  function selectOffsets(root, start, end) {
    var ser = serialize(root);
    var a = boundPoint(ser.points, start, false);
    var b = boundPoint(ser.points, end, true);
    if (!a || !b) {
      root.focus();
      return false;
    }
    var range = document.createRange();
    try {
      range.setStart(a.node, Math.min(a.offset, a.node.nodeType === 3 ? a.node.nodeValue.length : 0));
      range.setEnd(b.node, Math.min(b.offset, b.node.nodeType === 3 ? b.node.nodeValue.length : 0));
    } catch (err) {
      return false;
    }
    root.focus();
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }

  function rangeIndex(ser, node, offset) {
    if (!ser.points.length) return 0;
    for (var i = 0; i < ser.points.length; i++) {
      var p = ser.points[i];
      if (p.node === node && p.offset >= offset) return i;
    }
    var lastOnNode = -1;
    for (var j = 0; j < ser.points.length; j++) {
      if (ser.points[j].node === node) lastOnNode = j;
    }
    if (lastOnNode >= 0) return lastOnNode + 1;
    try {
      var probe = document.createRange();
      probe.setStart(ser.points[0].node, ser.points[0].offset);
      probe.setEnd(node, offset);
      var prefix = probe.toString().replace(SKIP_RE, "");
      return Math.min(prefix.length, ser.points.length);
    } catch (err) {
      return ser.points.length;
    }
  }

  function caretOffsets(root) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { start: serialize(root).text.length, end: serialize(root).text.length };
    var range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer) && root !== range.commonAncestorContainer) {
      var n = serialize(root).text.length;
      return { start: n, end: n };
    }
    var ser = serialize(root);
    var start = rangeIndex(ser, range.startContainer, range.startOffset);
    var end = rangeIndex(ser, range.endContainer, range.endOffset);
    if (end < start) {
      var t = start;
      start = end;
      end = t;
    }
    return { start: start, end: end };
  }

  function rangeFor(root, start, end) {
    var ser = serialize(root);
    if (start < 0 || end > ser.points.length || start >= end) return null;
    var a = ser.points[start];
    var b = ser.points[end - 1];
    if (!a || !b) return null;
    var range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      var endOff = b.node.nodeType === 3 ? b.offset + 1 : 0;
      range.setEnd(b.node, endOff);
    } catch (err) {
      return null;
    }
    return range;
  }

  function isTextareaLike(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      var type = (el.type || "text").toLowerCase();
      return type === "text" || type === "search" || type === "url" || type === "email" || type === "tel" || type === "";
    }
    return false;
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isTextareaLike(el)) return el.type !== "password";
    if (el.isContentEditable) return true;
    var ce = el.getAttribute("contenteditable");
    if (ce === "true" || ce === "" || ce === "plaintext-only") return true;
    if (el.getAttribute("role") === "textbox") return true;
    return false;
  }

  function adapt(el) {
    if (isTextareaLike(el) || el.__mcpheeAdapted) return el;
    el.__mcpheeAdapted = true;
    Object.defineProperty(el, "value", {
      configurable: true,
      get: function () { return serialize(el).text; },
    });
    Object.defineProperty(el, "selectionStart", {
      configurable: true,
      get: function () { return caretOffsets(el).start; },
    });
    Object.defineProperty(el, "selectionEnd", {
      configurable: true,
      get: function () { return caretOffsets(el).end; },
    });
    el.setSelectionRange = function (start, end) {
      selectOffsets(el, start, end == null ? start : end);
    };
    el.setRangeText = function (replacement, start, end) {
      selectOffsets(el, start, end);
      document.execCommand("insertText", false, replacement);
    };
    if (el.spellcheck !== undefined) el.spellcheck = false;
    return el;
  }

  function unadapt(el) {
    if (!el || !el.__mcpheeAdapted) return;
    delete el.__mcpheeAdapted;
    delete el.value;
    delete el.selectionStart;
    delete el.selectionEnd;
    delete el.setSelectionRange;
    delete el.setRangeText;
  }

  var MARK_CLASS = {
    misspelled: "mcphee-ce-box-misspelled",
    unknown: "mcphee-ce-box-unknown",
    doublespace: "mcphee-ce-box-doublespace",
    capitalization: "mcphee-ce-box-capitalization",
    punctuation: "mcphee-ce-box-punctuation",
    echo: "mcphee-ce-box-echo",
    obscure: "mcphee-ce-box-obscure",
    culture: "mcphee-ce-box-culture",
    obscureRepeat: "mcphee-ce-box-obscure",
  };

  function attachRangeOverlay(el, checker, opts) {
    var renderOpts = { rules: checker.resolveRules(opts) };
    var layer = document.createElement("div");
    layer.className = "mcphee-ce-layer";
    layer.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(layer);

    var enabled = true;
    var integrityFailed = false;
    var boxes = [];

    function clearLayer() {
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      boxes = [];
    }

    function hide() {
      layer.style.visibility = "hidden";
    }

    function show() {
      layer.style.visibility = enabled && !integrityFailed ? "visible" : "hidden";
    }

    function issueClass(issue) {
      if (issue.kind === "word") return MARK_CLASS[issue.classification] || MARK_CLASS.misspelled;
      return MARK_CLASS[issue.kind] || MARK_CLASS.misspelled;
    }

    function refresh(force) {
      if (!enabled) {
        hide();
        return;
      }
      if (!el.isConnected) {
        hide();
        return;
      }
      var text = el.value;

      var issues;
      try {
        renderOpts.caret = el.selectionStart;
        issues = checker.analyze(text, renderOpts);
      } catch (err) {
        integrityFailed = true;
        clearLayer();
        hide();
        return;
      }

      clearLayer();
      var ok = true;
      var fieldRect = el.getBoundingClientRect();
      if (fieldRect.width < 2 || fieldRect.height < 2) {
        integrityFailed = true;
        hide();
        return;
      }

      for (var i = 0; i < issues.length; i++) {
        var issue = issues[i];
        var range = rangeFor(el, issue.start, issue.end);
        if (!range) {
          ok = false;
          break;
        }
        var got = range.toString().replace(SKIP_RE, "");
        var want = text.slice(issue.start, issue.end).replace(/\n/g, "");
        // Range.toString joins across elements without the newlines we
        // inserted for blocks; compare against the issue's letters/spaces.
        var gotNorm = got.replace(/\n/g, "");
        if (gotNorm !== want && got !== text.slice(issue.start, issue.end)) {
          ok = false;
          break;
        }
        var rects = range.getClientRects();
        if (!rects.length) {
          ok = false;
          break;
        }
        for (var r = 0; r < rects.length; r++) {
          var rect = rects[r];
          if (rect.width < 1 && rect.height < 1) continue;
          var box = document.createElement("div");
          box.className = "mcphee-ce-box " + issueClass(issue);
          box.dataset.start = String(issue.start);
          box.style.left = rect.left + "px";
          box.style.top = rect.top + "px";
          box.style.width = rect.width + "px";
          box.style.height = rect.height + "px";
          layer.appendChild(box);
          boxes.push(box);
        }
      }

      if (!ok) {
        if (!integrityFailed) {
          console.warn("McPhee: contenteditable highlight mapping failed; hiding highlights rather than showing them misaligned.");
        }
        integrityFailed = true;
        clearLayer();
        hide();
        return;
      }
      integrityFailed = false;
      show();
    }

    function onEvent() { refresh(); }

    function onSelectionChange() {
      if (document.activeElement === el) refresh();
    }

    el.addEventListener("input", onEvent);
    el.addEventListener("scroll", onEvent, true);
    window.addEventListener("scroll", onEvent, true);
    window.addEventListener("resize", onEvent);
    var resizeObserver = new ResizeObserver(onEvent);
    resizeObserver.observe(el);
    var pollTimer = setInterval(refresh, 700);
    document.addEventListener("selectionchange", onSelectionChange);

    var ctrlTapClean = false;
    function onAnyKeyDown(e) {
      if (e.key === "Control") {
        if (!e.repeat && document.activeElement === el) ctrlTapClean = true;
        return;
      }
      ctrlTapClean = false;
    }
    function onCtrlKeyUp(e) {
      if (e.key !== "Control") return;
      var wasClean = ctrlTapClean;
      ctrlTapClean = false;
      if (!wasClean || !enabled) return;
      if (document.activeElement !== el) return;
      checker.applyNearestBackwardFix(el, { rules: renderOpts.rules });
    }
    window.addEventListener("keydown", onAnyKeyDown, true);
    window.addEventListener("keyup", onCtrlKeyUp, true);

    refresh(true);

    return {
      refresh: refresh,
      scrollToOffset: function (offset) {
        var range = rangeFor(el, offset, Math.min(offset + 1, (el.value || "").length || 1));
        if (range && range.getBoundingClientRect) {
          var node = range.startContainer;
          if (node.nodeType === 3) node = node.parentElement;
          if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
        }
      },
      hoverStart: function (starts) {
        this.hoverStop();
        starts.forEach(function (s) {
          layer.querySelectorAll('[data-start="' + s + '"]').forEach(function (box) {
            box.classList.add("mcphee-ce-box-hover");
          });
        });
      },
      hoverStop: function () {
        layer.querySelectorAll(".mcphee-ce-box-hover").forEach(function (box) {
          box.classList.remove("mcphee-ce-box-hover");
        });
      },
      visibleStarts: function () {
        var out = new Set();
        var taR = el.getBoundingClientRect();
        var top = Math.max(taR.top, 0);
        var bottom = Math.min(taR.bottom, window.innerHeight || document.documentElement.clientHeight);
        if (bottom <= top) return out;
        boxes.forEach(function (box) {
          var r = box.getBoundingClientRect();
          if (r.bottom >= top && r.top <= bottom) out.add(+box.dataset.start);
        });
        return out;
      },
      setRules: function (o) {
        renderOpts.rules = checker.resolveRules(o);
        refresh(true);
      },
      setEnabled: function (on) {
        enabled = !!on;
        if (enabled) refresh(true);
        else hide();
      },
      detach: function () {
        clearInterval(pollTimer);
        el.removeEventListener("input", onEvent);
        el.removeEventListener("scroll", onEvent, true);
        window.removeEventListener("scroll", onEvent, true);
        window.removeEventListener("resize", onEvent);
        resizeObserver.disconnect();
        window.removeEventListener("keydown", onAnyKeyDown, true);
        window.removeEventListener("keyup", onCtrlKeyUp, true);
        document.removeEventListener("selectionchange", onSelectionChange);
        layer.remove();
        unadapt(el);
      },
    };
  }

  global.McPheeEditable = {
    serialize: serialize,
    isTextareaLike: isTextareaLike,
    isEditable: isEditable,
    adapt: adapt,
    unadapt: unadapt,
    attachRangeOverlay: attachRangeOverlay,
    rangeFor: rangeFor,
  };
})(typeof window !== "undefined" ? window : this);
