"""Real-browser suite (Playwright + demo.html): the things the Node tests
cannot see — overlay visibility, wrap-parity integrity, wrap points at
fractional widths, hover highlighting, panel section order, in-progress-word
hiding, Control-tap correction, first-suggestion alignment, and suggestion
acceptance.

Geometry is never asserted with pixel math on marks. The library's own
integrity self-check is the primary oracle: if the overlay stays visible,
content and wrap parity held; if it hides itself or warns, the test fails.
One exception, because the self-check is provably blind to it: wrap-point
divergence that keeps the line count unchanged. That is asserted by
comparing which characters land on which line against a reference mirror
sized at the textarea's exact fractional width (see WRAP_POINT_JS).

Run: python test/browser/suite.py
Requires: pip install playwright && playwright install chromium
Optional: a prod_bodies.json beside this file ([{"id":..,"body":".."}]) adds
real article bodies to the content matrix. It is never committed.
"""
import functools
import http.server
import json
import os
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = 8763
FAILURES = 0


def ok(cond, label):
    global FAILURES
    print(("ok    " if cond else "FAIL  ") + label)
    if not cond:
        FAILURES += 1


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a, **k: None
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# Compares the backdrop's wrap points (which characters land on which line)
# against a reference mirror sized at the textarea's exact fractional width.
# The reference carries no marks, so it also verifies that mark elements do
# not perturb line breaking. Also builds a second mirror sized the way the
# overlay was sized before v3.9.1 (integer clientWidth): its diff count shows
# whether the current width would have diverged under the old sizing.
WRAP_POINT_JS = """() => {
    const ta = document.querySelector('.mcphee-textarea');
    const backdrop = document.querySelector('.mcphee-backdrop');
    const cs = getComputedStyle(ta);

    function lineTexts(el) {
        const lines = []; let curY = null, cur = '';
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const s = node.nodeValue;
            for (let i = 0; i < s.length; i++) {
                const r = document.createRange();
                r.setStart(node, i); r.setEnd(node, i + 1);
                const y = Math.round(r.getBoundingClientRect().top);
                if (curY === null) curY = y;
                if (Math.abs(y - curY) > 2) { lines.push(cur); cur = ''; curY = y; }
                cur += s[i];
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    function makeMirror(widthPx) {
        const d = document.createElement('div');
        for (const p of ['fontFamily','fontSize','fontWeight','fontStyle',
            'letterSpacing','lineHeight','textTransform','wordSpacing','textIndent',
            'whiteSpace','overflowWrap','wordBreak','tabSize','direction',
            'paddingTop','paddingRight','paddingBottom','paddingLeft',
            'borderTopWidth','borderRightWidth','borderBottomWidth',
            'borderLeftWidth']) d.style[p] = cs[p];
        d.style.whiteSpace = 'pre-wrap';
        d.style.overflowWrap = 'break-word';
        d.style.boxSizing = 'border-box';
        d.style.borderStyle = 'solid';
        d.style.borderColor = 'transparent';
        d.style.position = 'absolute';
        d.style.visibility = 'hidden';
        d.style.width = widthPx + 'px';
        d.textContent = ta.value + '\\n';
        document.body.appendChild(d);
        return d;
    }

    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const ref = makeMirror(ta.getBoundingClientRect().width);
    const rounded = makeMirror(ta.clientWidth + bl + br);
    const refLines = lineTexts(ref);
    const roundedLines = lineTexts(rounded);
    const bdLines = lineTexts(backdrop);
    ref.remove();
    rounded.remove();

    function diffLines(a, b) {
        const out = [];
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if (a[i] !== b[i]) out.push(i);
        }
        return out;
    }
    const diffs = diffLines(refLines, bdLines);
    return {
        diffCount: diffs.length,
        roundedDiffCount: diffLines(refLines, roundedLines).length,
        firstDiff: diffs.length ? {
            line: diffs[0],
            reference: refLines[diffs[0]],
            backdrop: bdLines[diffs[0]],
        } : null,
    };
}"""

# Chooses a host width that plants a word boundary INSIDE the clientWidth
# rounding gap: the first line's word prefix is measured at full precision,
# then the width is set so the prefix fits the true fractional client width
# but not the integer-rounded one. Deterministic by construction — no
# scanning for an unlucky width, no font assumptions.
AIM_JS = """() => {
    const ta = document.querySelector('.mcphee-textarea');
    const cs = getComputedStyle(ta);
    // The probe is styled with the same property list the mirror uses, so
    // its measured width is the width the mirror will lay the text out at —
    // sub-pixel identical, no shorthand approximations.
    const probe = document.createElement('div');
    for (const p of ['fontFamily','fontSize','fontWeight','fontStyle',
        'letterSpacing','lineHeight','textTransform','wordSpacing','textIndent',
        'wordBreak','tabSize','direction']) probe.style[p] = cs[p];
    probe.style.whiteSpace = 'pre';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);

    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;

    // Walk successive word prefixes (starting near a 450px line) until one
    // measures a client width whose fraction sits inside (0.03, 0.27). For
    // that prefix, client = floor + 0.3 means: the exact fractional content
    // width fits the prefix, while the integer-rounded clientWidth does not
    // — the wrap point sits inside the rounding gap by construction.
    // Returned as the CSS width to set on the TEXTAREA itself, converted
    // for its box-sizing (the demo textarea is content-box).
    const words = ta.value.split(' ');
    let prefix = words[0];
    for (let i = 1; i < words.length; i++) {
        prefix += ' ' + words[i];
        probe.textContent = prefix;
        const P = probe.getBoundingClientRect().width;
        if (P < 450) continue;
        const f = (P + padL + padR) % 1;
        if (f > 0.03 && f < 0.27) {
            probe.remove();
            const client = Math.floor(P + padL + padR) + 0.3;
            return cs.boxSizing === 'border-box'
                ? client + bl + br
                : client - padL - padR;
        }
    }
    probe.remove();
    return null;
}"""


def overlay_state(page):
    return page.evaluate("""() => {
        const backdrop = document.querySelector(".mcphee-backdrop");
        return {
            visibility: backdrop ? getComputedStyle(backdrop).visibility : null,
            marks: backdrop ? backdrop.querySelectorAll("mark").length : 0,
        };
    }""")


def set_text_and_settle(page, body):
    # fill() fires real input events, like typing; the overlay AND the panel
    # both react. (A bare .value write only reaches the overlay's poll.)
    page.fill(".mcphee-textarea", body)
    page.wait_for_timeout(1800)  # 700ms poll + render + one self-repair round


def content_matrix():
    cases = [
        ("emoji + CJK", "The fox 🦊 jumped over 日本語のテキスト and kept going. " * 40),
        ("long unbroken line", "x" * 5000 + " teh end."),
        ("tabs and indentation", ("\tindented code line\n    four-space line\nnormal teh line\n") * 50),
        ("many blank lines", ("word\n\n\n\n" * 200) + "final teh."),
        ("unusual separators", "line one.\u2028odd separators\u00a0nbsp teh here. " * 30),
    ]
    prod = os.path.join(os.path.dirname(__file__), "prod_bodies.json")
    if os.path.exists(prod):
        with open(prod, encoding="utf-8") as f:
            for c in json.load(f):
                cases.insert(0, (f"local body {c['id']} ({len(c['body'])} chars)", c["body"]))
    return cases


def main():
    httpd = serve()
    warnings = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda m: warnings.append(m.text) if m.type in ("warning", "error") else None)
        page.goto(f"http://127.0.0.1:{PORT}/demo.html")
        page.wait_for_selector(".mcphee-panel-item", timeout=15000)
        page.wait_for_timeout(1200)

        # --- overlay basics ---
        st = overlay_state(page)
        ok(st["visibility"] == "visible", "overlay visible on load")
        ok(st["marks"] > 0, "marks rendered")
        ok(not any("integrity" in w for w in warnings), "no integrity warnings on load")

        # --- marks actually PAINT: every category mark has a non-transparent
        # computed background (classes and geometry alone once passed while a
        # specificity bug blanked every color) ---
        paint = page.evaluate("""() => {
            const bad = [];
            document.querySelectorAll(".mcphee-backdrop mark").forEach(m => {
                const bg = getComputedStyle(m).backgroundColor;
                if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bad.push(m.className);
            });
            return bad.slice(0, 5);
        }""")
        ok(len(paint) == 0, f"every mark paints a visible background ({paint})")

        # --- hover highlight: solid color change, instant on/off, no motion ---
        page.locator(".mcphee-panel-item").first.hover()
        page.wait_for_timeout(150)
        hov = page.evaluate("""() => {
            const marks = document.querySelectorAll(".mcphee-mark-hover");
            const cs = marks[0] ? getComputedStyle(marks[0]) : null;
            return {
                count: marks.length,
                background: cs ? cs.backgroundColor : null,
                animation: cs ? cs.animationName : null,
                transition: cs ? cs.transitionDuration : null,
            };
        }""")
        ok(hov["count"] >= 1, "hovering a row highlights its mark(s)")
        ok(hov["background"] == "rgb(255, 176, 32)",
           f"hover paints the solid amber background ({hov['background']})")
        ok(hov["animation"] == "none", f"no animation on the hover highlight ({hov['animation']})")
        ok(hov["transition"] in ("0s", None) or all(t.strip() == "0s" for t in (hov["transition"] or "").split(",")),
           f"no transition on the hover highlight ({hov['transition']})")
        page.mouse.move(0, 0)
        page.wait_for_timeout(150)
        ok(page.evaluate("document.querySelectorAll('.mcphee-mark-hover').length") == 0,
           "leaving the row clears the highlight instantly")

        # --- repeat rows highlight EVERY occurrence at once ---
        repeat_row = page.locator(
            ".mcphee-panel-item:has(.mcphee-panel-word-obscure), "
            ".mcphee-panel-item:has(.mcphee-panel-word-echo)").first
        repeat_row.hover()
        page.wait_for_timeout(150)
        ok(page.evaluate("document.querySelectorAll('.mcphee-mark-hover').length") >= 2,
           "hovering a repeat row highlights both/all uses")
        page.mouse.move(0, 0)

        # --- "not rare" permanently exempts a frequency-list gap ---
        obscure_rows = page.locator(".mcphee-panel-item:has(.mcphee-panel-word-obscure)")
        before = obscure_rows.count()
        if before:
            obscure_rows.first.locator("button", has_text="not rare").click()
            page.wait_for_timeout(400)
            ok(obscure_rows.count() < before, "'not rare' removes the obscure row")
        else:
            ok(False, "demo has an obscure row to mark not rare")

        # --- panel section order: one color block per issue type ---
        order = page.evaluate("""() => {
            const rank = { misspelled: 0, unknown: 1, culture: 2, echo: 3,
                           obscure: 4, capitalization: 5, punctuation: 6, doublespace: 7 };
            const rows = [...document.querySelectorAll(".mcphee-panel-item .mcphee-panel-word")];
            return rows.map(w => {
                const cls = [...w.classList].find(c => c.startsWith("mcphee-panel-word-"));
                return rank[cls ? cls.replace("mcphee-panel-word-", "") : ""] ?? -1;
            });
        }""")
        ok(all(a <= b for a, b in zip(order, order[1:])),
           f"panel rows grouped by section, never interleaved (ranks {order})")

        # --- phrase echo uses full, correctly aligned spans ---
        set_text_and_settle(page, "I do not care at all whether this works at all today.")
        phrase_row = page.locator(".mcphee-panel-word-echo", has_text="at all").first
        ok(phrase_row.count() == 1, "repeated phrase gets one panel row")
        phrase_marks = page.evaluate("""() =>
            [...document.querySelectorAll(".mcphee-mark-echo")]
                .map(m => m.textContent)
                .filter(t => t === "at all")
        """)
        ok(len(phrase_marks) == 2, "both full phrase spans are marked")
        phrase_row.locator("..").locator("..").hover()
        page.wait_for_timeout(150)
        ok(page.evaluate("document.querySelectorAll('.mcphee-mark-hover').length") == 2,
           "hovering a phrase row highlights both full phrases")
        page.mouse.move(0, 0)

        # --- host-page mark styling must not perturb wrap parity ---
        # (Bootstrap's reboot pads `mark`; with hundreds of marks the drift
        # once compounded into extra wraps and the overlay fail-closed.)
        page.add_style_tag(content="mark { padding: 0 0.1875em; border: 1px solid red; }")
        warnings.clear()
        set_text_and_settle(page, "Thsi is a wierd littel sentence with teh errors. " * 120)
        st = overlay_state(page)
        ok(st["visibility"] == "visible" and not any("integrity" in w for w in warnings),
           "overlay survives host-page mark styling on many-mark content")

        # --- content matrix: integrity must hold on every body ---
        for name, body in content_matrix():
            warnings.clear()
            set_text_and_settle(page, body)
            st = overlay_state(page)
            ok(st["visibility"] == "visible" and not any("integrity" in w for w in warnings),
               f"integrity holds: {name}")

        # --- wrap-point parity at fractional widths ---
        # The integrity self-check compares scrollHeights, which is blind to
        # a divergence that moves one word to the next line without changing
        # the line count (the v3.9.1 sub-pixel width bug did exactly this:
        # the backdrop was sized from integer-rounded clientWidth while the
        # textarea wrapped at its true fractional width, and every mark
        # below the flipped wrap point displayed shifted by one word). So
        # wrap points are checked directly: which words land on which line,
        # backdrop vs a reference mirror sized at the textarea's exact
        # fractional width.
        prose = ("the quick brown fox jumps over the lazy dog while teh "
                 "narrator keeps describing scenery, weather, altitude and "
                 "vegetation in long meandering sentences that wrap across "
                 "many lines. every additional clause nudges the wrap points "
                 "around, and a word boundary occasionally lands within a "
                 "fraction of a pixel of the edge, which is exactly the "
                 "situation this matrix exists to exercise. wierd spellings "
                 "and repeated repeated words give the overlay marks to "
                 "render, since marks themselves must never perturb where "
                 "any line breaks.")
        # A proportional font is required here: the demo's monospace has
        # integer character advances, so line widths never carry a fraction
        # and the rounding gap contains no word boundary to catch. (This is
        # also why the bug never surfaced in the demo — it was found in a
        # host app with a 22px proportional font.) The font swap is picked
        # up by the overlay's self-repair on the next render.
        page.add_style_tag(content=
            ".mcphee-textarea { font: 22px/1.4 system-ui, sans-serif !important; }")
        warnings.clear()
        set_text_and_settle(page, prose)
        for tenth in (1, 3, 5, 7, 9):
            page.add_style_tag(
                content=f".mcphee-host {{ width: {697 + tenth / 10}px !important; }}")
            page.wait_for_timeout(300)  # ResizeObserver -> syncGeometry
            res = page.evaluate(WRAP_POINT_JS)
            st = overlay_state(page)
            ok(st["visibility"] == "visible" and res["diffCount"] == 0
               and not any("integrity" in w for w in warnings),
               f"wrap points match the textarea's exact width at 697.{tenth}px "
               f"(diverging lines: {res['diffCount']}, first: {res['firstDiff']})")
        # The aimed case: a word boundary planted inside the rounding gap.
        aimed = page.evaluate(AIM_JS)
        ok(aimed is not None, "found a word prefix with a usable width fraction")
        page.add_style_tag(
            content=f".mcphee-textarea {{ width: {aimed}px !important; }}")
        page.wait_for_timeout(300)
        res = page.evaluate(WRAP_POINT_JS)
        ok(res["roundedDiffCount"] > 0,
           f"canary at {aimed:.3f}px: integer-rounded sizing diverges here, "
           f"so this case has teeth ({res['roundedDiffCount']} lines)")
        ok(res["diffCount"] == 0,
           f"wrap points survive a word boundary inside the clientWidth "
           f"rounding gap (diverging lines: {res['diffCount']}, "
           f"first: {res['firstDiff']})")
        page.add_style_tag(content=".mcphee-host { width: 100% !important; }")
        page.add_style_tag(content=
            ".mcphee-textarea { width: 100% !important;"
            " font: 15px/1.5 monospace !important; }")

        # --- a render that throws fails closed, then recovers ---
        # The state audit found lastRendered was assigned before the render:
        # an analyzer exception left stale marks visible AND believed-current,
        # so even the poll never repaired them. Now a render that does not
        # complete is an integrity failure: the overlay hides, and the poll
        # retries until a full render verifies again.
        crash = page.evaluate("""async () => {
            const m = await McPhee.create({
                affUrl: "vendor/typo/en_US.aff",
                dicUrl: "vendor/typo/en_US.dic",
                freqUrl: "vendor/wordfreq/en-30k.txt",
            });
            const ta = document.createElement("textarea");
            document.body.appendChild(ta);
            ta.value = "first teh text";
            const ctl = m.attach(ta);
            const backdrop = ta.closest(".mcphee-host").querySelector(".mcphee-backdrop");
            const visibleBefore = getComputedStyle(backdrop).visibility;
            const marksBefore = backdrop.querySelectorAll("mark").length;
            m.renderHtml = () => { throw new Error("injected analyzer crash"); };
            ta.value = "second wierd text";
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            const visibleDuring = getComputedStyle(backdrop).visibility;
            delete m.renderHtml;
            await new Promise(r => setTimeout(r, 1600));  // > one 700ms poll
            const visibleAfter = getComputedStyle(backdrop).visibility;
            const parityAfter = backdrop.textContent === ta.value + "\\n";
            ctl.detach();
            ta.remove();
            return { visibleBefore, marksBefore, visibleDuring, visibleAfter, parityAfter };
        }""")
        ok(crash["visibleBefore"] == "visible" and crash["marksBefore"] > 0,
           "crash test baseline: overlay visible with marks")
        ok(crash["visibleDuring"] == "hidden",
           f"a throwing render hides the overlay instead of showing stale marks "
           f"({crash['visibleDuring']})")
        ok(crash["visibleAfter"] == "visible" and crash["parityAfter"],
           f"the poll re-renders and re-verifies once the analyzer heals "
           f"(visibility {crash['visibleAfter']}, parity {crash['parityAfter']})")
        warnings.clear()  # the injected crash legitimately warned once

        # --- the word being typed is not marked misspelled ---
        set_text_and_settle(page, "teh cat ran.")
        page.evaluate("""() => {
            const ta = document.querySelector('.mcphee-textarea');
            ta.focus();
            ta.setSelectionRange(3, 3);
        }""")
        page.wait_for_timeout(900)
        in_word = page.evaluate("""() => {
            const marks = [...document.querySelectorAll('.mcphee-backdrop .mcphee-mark-misspelled')];
            return {
                values: marks.map(m => m.textContent),
                panelHasTeh: [...document.querySelectorAll('.mcphee-panel-word-misspelled')]
                    .some(w => w.textContent.replace(/\\s.*/, '') === 'teh'),
            };
        }""")
        ok("teh" not in in_word["values"],
           f"in-progress teh is not overlay-marked ({in_word['values']})")
        ok(not in_word["panelHasTeh"], "in-progress teh is not in the panel")
        page.evaluate("""() => {
            const ta = document.querySelector('.mcphee-textarea');
            ta.setSelectionRange(ta.value.length, ta.value.length);
        }""")
        page.wait_for_timeout(900)
        left_word = page.evaluate("""() =>
            [...document.querySelectorAll('.mcphee-backdrop .mcphee-mark-misspelled')]
                .map(m => m.textContent)
        """)
        ok("teh" in left_word, f"teh is marked once the caret leaves it ({left_word})")

        # --- Control tap: naive-correct nearest misspelling behind the caret ---
        set_text_and_settle(page, "The dog sat. teh cat ran.")
        page.locator(".mcphee-textarea").focus()
        page.keyboard.press("Control")
        page.wait_for_timeout(500)
        after_ctrl = page.evaluate("document.querySelector('.mcphee-textarea').value")
        ok("teh" not in after_ctrl and "the cat" in after_ctrl,
           f"Control tap corrected teh ({after_ctrl!r})")

        set_text_and_settle(page, "i fi")
        page.locator(".mcphee-textarea").focus()
        page.keyboard.press("Control")
        page.wait_for_timeout(500)
        after_region = page.evaluate("document.querySelector('.mcphee-textarea').value")
        ok(after_region == "if I",
           f"Control tap rewrites i fi as the local pair if I ({after_region!r})")

        # --- first suggestion buttons share a vertical line ---
        set_text_and_settle(page, "teh cat. wierd dog. recieve mail.")
        align = page.evaluate("""() => {
            const rows = [...document.querySelectorAll(
                '.mcphee-panel-item:has(.mcphee-panel-word-misspelled)')];
            const xs = rows.map(r => {
                const s = r.querySelector('.mcphee-panel-suggestion');
                return s ? Math.round(s.getBoundingClientRect().left) : null;
            }).filter(x => x !== null);
            if (xs.length < 2) return { ok: false, reason: 'need 2+ rows', xs };
            const spread = Math.max(...xs) - Math.min(...xs);
            return { ok: spread <= 1, spread, xs };
        }""")
        ok(align.get("ok"),
           f"first suggestion of each misspelled row aligns (spread {align.get('spread')}px, xs={align.get('xs')})")

        # --- accepting a suggestion keeps the overlay honest ---
        set_text_and_settle(page, "The dog sat. teh cat ran fast here.")
        rows_before = page.locator(".mcphee-panel-item").count()
        sugg = page.locator(".mcphee-panel-suggestion").first
        if sugg.count():
            warnings.clear()
            sugg.click()
            page.wait_for_timeout(1200)
            changed = page.evaluate("document.querySelector('.mcphee-textarea').value")
            ok("teh" not in changed, "suggestion click rewrites the text")
            ok(page.locator(".mcphee-panel-item").count() < rows_before, "acted-on row leaves the panel")
            ok(not any("integrity" in w for w in warnings), "no integrity warnings after acceptance")
        else:
            ok(False, "found a suggestion button to click")

        browser.close()
    httpd.shutdown()
    print("\n" + (f"{FAILURES} FAILURES" if FAILURES else "ALL PASS"))
    raise SystemExit(1 if FAILURES else 0)


if __name__ == "__main__":
    main()
