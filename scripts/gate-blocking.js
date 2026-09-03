#!/usr/bin/env node
/**
 * scripts/gate-blocking.js
 *
 * Reusable-workflow gate. Reads findings.json (default, or argv[2]) and FAILS
 * the PR check (exit 1) when at least one finding is `error` severity -- the
 * blocking structural findings from checker/rules/structure.js (no frontmatter
 * / 0 parsed steps). Every other finding (markdownlint, cspell, links, secrets,
 * and the notify-only content rules) is warning/notice and never trips the gate.
 *
 * This is the ONE place tutorial-ci departs from notify-only. It fails open: a
 * missing or malformed findings file exits 0 (never block on infra failure).
 */
import { readFileSync } from "node:fs";
import { hasBlockingFinding } from "./normalize-findings.js";

const path = process.argv[2] || "findings.json";

let findings = [];
try {
  findings = JSON.parse(readFileSync(path, "utf8"));
} catch {
  // No findings file or malformed JSON -> nothing to gate on; pass (fail-open).
  process.exit(0);
}
if (!Array.isArray(findings)) process.exit(0);

if (!hasBlockingFinding(findings)) {
  console.log("tutorial-ci gate: no blocking (structural) findings -- PASS");
  process.exit(0);
}

const blocking = findings.filter((f) => f && f.severity === "error");
console.error(
  `\ntutorial-ci gate: ${blocking.length} blocking finding(s) -- this PR introduces or modifies a tutorial the pipeline cannot render:\n`,
);
for (const f of blocking) {
  console.error(`  x ${f.file}:${f.line} [${f.rule}] ${f.message}`);
}
console.error(
  "\nFix the structural error(s) above. Other lint / spelling / link findings remain notify-only.\n",
);
process.exit(1);
