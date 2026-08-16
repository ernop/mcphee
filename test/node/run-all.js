// Runs every Node analysis-layer test in its own process.
// Run: node test/node/run-all.js  (or: npm test)
"use strict";
const path = require("path");
const { spawnSync } = require("child_process");

const files = ["rules.js", "phrases.js", "exclusions.js", "caret.js", "live.js", "checkers.js"];
let failed = 0;

for (const f of files) {
  console.log("\n=== " + f + " ===");
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}

console.log(failed ? "\n" + failed + " SUITE(S) FAILED" : "\nALL SUITES PASS");
process.exit(failed ? 1 : 0);
