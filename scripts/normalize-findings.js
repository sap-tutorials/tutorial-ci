import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * @typedef {{ category: string, file: string, line: number, severity: string, rule: string, message: string }} Finding
 */

/**
 * Normalize raw tool outputs into a unified Finding[].
 * @param {{ markdownlint: any[], gitleaks: any[], lychee: any }} inputs
 * @returns {Finding[]}
 */
export function normalizeFindings({ markdownlint = [], gitleaks = [], lychee = {}, content = [] }) {
  const findings = [];

  // markdownlint-cli2 JSON output: array of { fileName, lineNumber, ruleNames, ruleDescription, ... }
  for (const entry of markdownlint) {
    findings.push({
      category: "markdown",
      file: entry.fileName,
      line: entry.lineNumber,
      severity: "warning",
      rule: Array.isArray(entry.ruleNames) ? entry.ruleNames[0] : entry.ruleNames,
      message: entry.ruleDescription,
    });
  }

  // gitleaks JSON report: array of { File, StartLine, RuleID, Description, ... }
  for (const entry of gitleaks) {
    findings.push({
      category: "secrets",
      file: entry.File,
      line: entry.StartLine,
      severity: "warning",
      rule: entry.RuleID,
      message: entry.Description,
    });
  }

  // lychee JSON output: { fail_map: { "file.md": [{ url, status }] } }
  const failMap = lychee?.fail_map ?? {};
  for (const [file, failures] of Object.entries(failMap)) {
    for (const failure of failures) {
      findings.push({
        category: "links",
        file,
        line: 0,
        severity: "notice",
        rule: "broken-link",
        message: `${failure.url} — ${failure.status}`,
      });
    }
  }

  // Pre-normalized content findings — pass through unchanged
  for (const f of content) {
    findings.push(f);
  }

  return findings;
}

/**
 * Render GitHub Actions workflow commands for each finding.
 * @param {Finding[]} findings
 * @returns {string}
 */
export function renderAnnotations(findings) {
  return findings
    .map((f) => {
      const level = f.severity === "notice" ? "notice" : "warning";
      return `::${level} file=${f.file},line=${f.line},title=${f.category}/${f.rule}::${f.message}`;
    })
    .join("\n");
}

/**
 * Render a sticky PR comment in markdown.
 * @param {Finding[]} findings
 * @param {{ sha: string }} opts
 * @returns {string}
 */
export function renderComment(findings, { sha }) {
  const marker = "<!-- tutorial-ci-findings -->";
  const footer = `_Checked ${sha} • notify-only, does not block merge_`;

  if (findings.length === 0) {
    return `${marker}\n✅ No issues found\n\n${footer}`;
  }

  // Group by category
  const groups = {};
  for (const f of findings) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }

  const sections = Object.entries(groups)
    .map(([cat, items]) => {
      const heading = `### ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${items.length})`;
      const bullets = items
        .map((f) => `- \`${f.file}:${f.line}\` — ${f.message}`)
        .join("\n");
      return `${heading}\n${bullets}`;
    })
    .join("\n\n");

  return `${marker}\n${sections}\n\n${footer}`;
}

// CLI shim — only runs when invoked directly, not when imported as a module
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , mlPath, glPath, lyPath, contentPath] = process.argv;

  const readJson = (p) => {
    try {
      const text = readFileSync(p, "utf8").trim();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  const markdownlint = readJson(mlPath) ?? [];
  const gitleaks = readJson(glPath) ?? [];
  const lycheeRaw = readJson(lyPath) ?? {};
  const content = readJson(contentPath) ?? [];

  console.log(JSON.stringify(normalizeFindings({ markdownlint, gitleaks, lychee: lycheeRaw, content })));
}
