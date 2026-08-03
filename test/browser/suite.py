"""Real-browser suite (Playwright + demo.html): the things the Node tests
cannot see — overlay visibility, wrap-parity integrity, hover highlighting,
panel section order, and suggestion acceptance.

Geometry is never asserted with pixel math. The library's own integrity
self-check is the oracle: if the overlay stays visible, content and wrap
parity held; if it hides itself or warns, the test fails.

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

        # --- hover highlight: solid color change, instant on/off, no motion ---
        page.locator(".mcphee-panel-item").first.hover()
        page.wait_for_timeout(150)
        hov = page.evaluate("""() => {
            const marks = document.querySelectorAll(".mcphee-mark-hover");
            const cs = marks[0] ? getComputedStyle(marks[0]) : null;
            return {
                count: marks.length,
                animation: cs ? cs.animationName : null,
                transition: cs ? cs.transitionDuration : null,
            };
        }""")
        ok(hov["count"] >= 1, "hovering a row highlights its mark(s)")
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
