import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * @typedef {{ category: string, file: string, line: number, severity: string, rule: string, message: string }} Finding
 */

/**
 * Normalize raw tool outputs into a unified Finding[].
 * @param {{ markdownlint: any[], gitleaks: any[], lychee: any, content?: any[], cspell?: any[] }} inputs
 * @returns {Finding[]}
 */
export function normalizeFindings({ markdownlint = [], gitleaks = [], lychee = {}, content = [], cspell = [] }) {
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

  // cspell (shaped) output: array of { file, line, word, suggestions? }
  // Notify-only at notice severity — spelling is advisory and never blocks merge.
  for (const entry of cspell) {
    const suggestions = Array.isArray(entry.suggestions) ? entry.suggestions.filter(Boolean) : [];
    const hint = suggestions.length ? ` — did you mean ${suggestions.slice(0, 3).join(", ")}?` : "";
    findings.push({
      category: "spelling",
      file: entry.file,
      line: entry.line ?? 0,
      severity: "notice",
      rule: "unknown-word",
      message: `Unknown word "${entry.word}"${hint}`,
    });
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
 * True when at least one finding is ERROR severity. Drives whether the
 * post-results workflow pings the content repo's assigned team(s). Warnings
 * and notices never trigger a mention (avoid alert fatigue).
 * @param {Finding[]} findings
 * @returns {boolean}
 */
export function hasErrorFinding(findings = []) {
  return Array.isArray(findings) && findings.some((f) => f && f.severity === "error");
}

/**
 * Compile a glob pattern (only `*` is special — matches any run of characters)
 * into an anchored, full-string RegExp. Every other character is treated as a
 * literal (regex metacharacters are escaped). No dependency, no `**`/`?`/char
 * classes — just the one wildcard the allowlist needs.
 *
 *   "devrelations-*" → /^devrelations-.*$/  → matches devrelations-{contribution,production}
 *   "authors"        → /^authors$/          → exact match only
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = String(pattern)
    .split("*")
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * True when `slug` matches at least one glob pattern in `allowlist`.
 * An empty/missing/non-array allowlist matches NOTHING (see below).
 * @param {string} slug
 * @param {string[]} allowlist
 * @returns {boolean}
 */
export function matchesAllowlist(slug, allowlist) {
  if (!slug || !Array.isArray(allowlist) || allowlist.length === 0) return false;
  return allowlist.some((pat) => typeof pat === "string" && pat.length > 0 && globToRegExp(pat).test(slug));
}

/**
 * Build `@<org>/<team-slug>` mention strings from the GitHub
 * "List repository teams" API response (GET /repos/{owner}/{repo}/teams),
 * filtered to a configurable glob ALLOWLIST of content-owner team slugs
 * (see config/notify-teams.json). This stops a content-check failure from
 * paging security / monitoring / admin teams that also have repo access.
 *
 * Edge cases (all handled here, never throw):
 *   - zero teams / null / non-array teams  → [] (caller posts with no mention)
 *   - empty / missing / non-array allowlist → [] (MENTION NONE — an
 *       unconfigured allowlist means "no content owners configured"; we fail
 *       SAFE rather than mentioning everyone)
 *   - multiple matching teams              → one mention each
 *   - entries missing a slug               → skipped
 *   - duplicate slugs                      → de-duplicated, order preserved
 *   - slug not matching any glob pattern   → dropped
 *
 * @param {Array<{ slug?: string }>} teams  raw API array
 * @param {string} org                       owner/org login (mention prefix)
 * @param {string[]} [allowlist=[]]          glob patterns; empty → mention none
 * @returns {string[]}
 */
export function buildTeamMentions(teams, org, allowlist = []) {
  if (!Array.isArray(teams) || !org) return [];
  // Empty/missing allowlist → mention NO teams (fail-safe; see config/notify-teams.json).
  if (!Array.isArray(allowlist) || allowlist.length === 0) return [];
  const seen = new Set();
  const mentions = [];
  for (const team of teams) {
    const slug = team && typeof team.slug === "string" ? team.slug.trim() : "";
    if (!slug || seen.has(slug)) continue;
    if (!matchesAllowlist(slug, allowlist)) continue;
    seen.add(slug);
    mentions.push(`@${org}/${slug}`);
  }
  return mentions;
}

/**
 * Render a sticky PR comment in markdown.
 * @param {Finding[]} findings
 * @param {{ sha: string, mentions?: string[] }} opts
 *   mentions — optional `@org/team` strings appended to ping the assigned
 *   team(s). Only supply these when an ERROR-severity finding is present;
 *   an empty/omitted list renders no mention (silent for warnings/notices).
 * @returns {string}
 */
export function renderComment(findings, { sha, mentions = [] } = {}) {
  const marker = "<!-- tutorial-ci-findings -->";
  const footer = `_Checked ${sha} • notify-only, does not block merge_`;
  const mentionLine =
    Array.isArray(mentions) && mentions.length > 0
      ? `\n\n⚠️ ${mentions.join(" ")} — error-severity issues were found in this PR; please review.`
      : "";

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

  return `${marker}\n${sections}${mentionLine}\n\n${footer}`;
}

// CLI shim — only runs when invoked directly, not when imported as a module
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , mlPath, glPath, lyPath, contentPath, spPath] = process.argv;

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
  const cspell = readJson(spPath) ?? [];

  console.log(JSON.stringify(normalizeFindings({ markdownlint, gitleaks, lychee: lycheeRaw, content, cspell })));
}
