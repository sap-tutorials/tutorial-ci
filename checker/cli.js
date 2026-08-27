#!/usr/bin/env node
/**
 * checker/cli.js
 *
 * Reads file paths from argv[2..] (space/newline separated), runs runChecks on
 * each with its repo-relative path as filename, prints JSON.stringify(allFindings)
 * to stdout, exits 0 always. Missing/unreadable files are skipped with console.error.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { runChecks } from "./index.js";
import { loadTaxonomy } from "./lib/taxonomy.js";

// Collect file paths: each argv may be a newline-delimited list (from the
// composite action) or a single path (from direct CLI use / tests).
const args = process.argv.slice(2)
  .flatMap((a) =>
    a.includes("\n")
      ? a.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : [a.trim()].filter(Boolean)
  )
  .filter(Boolean);

const allFindings = [];

// Load the canonical tag taxonomy once for the whole run (fail-open → null).
const taxonomy = await loadTaxonomy();

for (const filePath of args) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[checker] cannot read ${filePath}: ${err.message}`);
    continue;
  }

  // Compute repo-relative path (forward slashes)
  let repoRelative;
  try {
    repoRelative = relative(process.cwd(), resolve(filePath)).replace(/\\/g, "/");
  } catch {
    repoRelative = filePath;
  }

  const findings = runChecks(content, repoRelative, undefined, { taxonomy });
  allFindings.push(...findings);
}

console.log(JSON.stringify(allFindings));
process.exit(0);
