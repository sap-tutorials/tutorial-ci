import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Derive the set of gitleaks scan targets from a list of changed files.
 *
 * The secret scan must be scoped to the tutorial FOLDER(S) the PR touches —
 * findings elsewhere in the same folder are acceptable (e.g. a pre-existing
 * example key on an unchanged line), but a finding in a *different* tutorial
 * folder must never be attributed to this PR. A full-tree `--source .` scan
 * violated that: PR #192 (a 2-line edit in one tutorial) surfaced a "secret"
 * from an unrelated tutorial. Scoping to touched folders fixes it.
 *
 * Each changed file maps to its immediate parent directory. A file at the repo
 * root (dirname ".") maps to the file itself, never to "." — scanning "." would
 * re-introduce the whole-tree behaviour we are removing.
 *
 * Results are de-duplicated with first-occurrence order preserved.
 *
 * @param {string[]} files  repo-relative changed-file paths
 * @returns {string[]}      scan targets (directories, or root-level files)
 */
export function scanTargets(files = []) {
  const seen = new Set();
  const targets = [];
  for (const raw of files) {
    if (typeof raw !== "string") continue;
    const file = raw.trim().replace(/\\/g, "/");
    if (!file) continue;
    const dir = path.posix.dirname(file);
    // Root-level file → scan the file, not the entire repository.
    const target = dir === "." || dir === "" || dir === "/" ? file : dir;
    if (seen.has(target)) continue;
    seen.add(target);
    targets.push(target);
  }
  return targets;
}

// CLI shim — reads a newline-delimited changed-file list from the path given as
// argv[2] (falling back to stdin) and prints one scan target per line.
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const listPath = process.argv[2];
  let text = "";
  try {
    text = listPath ? readFileSync(listPath, "utf8") : readFileSync(0, "utf8");
  } catch {
    text = "";
  }
  const files = text.split("\n");
  process.stdout.write(scanTargets(files).join("\n"));
}
