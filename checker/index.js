import matter from "gray-matter";
import { allRules } from "./rules/index.js";

/**
 * parseContext(markdown, filename) → ctx
 *
 * Splits frontmatter + body using gray-matter, precomputes:
 *   - lines: markdown.split("\n")
 *   - frontmatterEndLine: 0-based index of the closing "---" line (or 0 if no frontmatter)
 *   - frontmatterRaw: the RAW text between the "---" fences (or "" when absent). This is
 *       the un-parsed YAML source; escape-aware rules (e.g. frontmatter-unknown-tag) use
 *       it to re-split values that gray-matter/js-yaml mangle — notably the SAP `\,`
 *       escaped-comma convention inside a flow-sequence `tags: [ … ]`, which js-yaml
 *       splits on the escaped comma AND drops the backslash.
 */
export function parseContext(markdown, filename) {
  const lines = markdown.split("\n");
  const parsed = matter(markdown);

  let frontmatterEndLine = 0;
  // Find the closing "---" of the frontmatter block (second occurrence at line start)
  if (markdown.startsWith("---")) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimEnd() === "---") {
        count++;
        if (count === 2) {
          frontmatterEndLine = i;
          break;
        }
      }
    }
  }

  // Raw YAML source between the fences (exclusive of both "---" lines).
  const frontmatterRaw =
    frontmatterEndLine > 0 ? lines.slice(1, frontmatterEndLine).join("\n") : "";

  return {
    markdown,
    filename,
    lines,
    frontmatter: parsed.data ?? {},
    body: parsed.content ?? "",
    frontmatterEndLine,
    frontmatterRaw,
  };
}

/**
 * runChecks(markdown, filename, rules?, options?) → Finding[]
 *
 * Runs each rule function with the parsed context. Each rule returns
 * partial findings { line, severity, rule, message }; the harness stamps
 * category:"content" + file:filename onto every finding before returning.
 *
 * options.taxonomy (Set<string>|null) is threaded onto ctx.taxonomy for the
 * taxonomy-aware rules (e.g. frontmatter-unknown-tag). It is loaded once per run
 * by the caller (cli.js) via lib/taxonomy.js and is null when unavailable — rules
 * fail open on a null/empty taxonomy.
 */
export function runChecks(markdown, filename, rules = allRules, options = {}) {
  const ctx = parseContext(markdown, filename);
  ctx.taxonomy = options.taxonomy ?? null;
  const findings = [];
  for (const rule of rules) {
    const partial = rule(ctx);
    if (Array.isArray(partial)) {
      for (const f of partial) {
        findings.push({ ...f, category: "content", file: filename });
      }
    }
  }
  return findings;
}
