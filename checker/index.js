import matter from "gray-matter";
import { allRules } from "./rules/index.js";

/**
 * parseContext(markdown, filename) → ctx
 *
 * Splits frontmatter + body using gray-matter, precomputes:
 *   - lines: markdown.split("\n")
 *   - frontmatterEndLine: 0-based index of the closing "---" line (or 0 if no frontmatter)
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

  return {
    markdown,
    filename,
    lines,
    frontmatter: parsed.data ?? {},
    body: parsed.content ?? "",
    frontmatterEndLine,
  };
}

/**
 * runChecks(markdown, filename, rules?) → Finding[]
 *
 * Runs each rule function with the parsed context. Each rule returns
 * partial findings { line, severity, rule, message }; the harness stamps
 * category:"content" + file:filename onto every finding before returning.
 */
export function runChecks(markdown, filename, rules = allRules) {
  const ctx = parseContext(markdown, filename);
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
