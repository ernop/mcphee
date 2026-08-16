#!/bin/sh
# Copies the library + dictionaries into this folder so the add-on is
# self-contained (manifest paths must resolve inside the extension root).
# Run after any mcphee.js / mcphee.css change, then reload in about:debugging.
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DEST="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
cp "$ROOT/mcphee.js" "$DEST/mcphee.js"
cp "$ROOT/mcphee.css" "$DEST/mcphee.css"
mkdir -p "$DEST/vendor/typo" "$DEST/vendor/wordfreq"
cp "$ROOT/vendor/typo/typo.min.js" "$DEST/vendor/typo/"
cp "$ROOT/vendor/typo/en_US.aff" "$DEST/vendor/typo/"
cp "$ROOT/vendor/typo/en_US.dic" "$DEST/vendor/typo/"
cp "$ROOT/vendor/typo/en_US_2026.aff" "$DEST/vendor/typo/"
cp "$ROOT/vendor/typo/en_US_2026.dic" "$DEST/vendor/typo/"
cp "$ROOT/vendor/wordfreq/en-30k.txt" "$DEST/vendor/wordfreq/"
echo "Assets copied. Load personalize-spelling-mcphee/manifest.json via about:debugging → This Firefox → Load Temporary Add-on."
