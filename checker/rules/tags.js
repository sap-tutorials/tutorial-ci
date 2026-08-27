/**
 * Tag taxonomy content-check rules.
 *
 * Rule ids:
 *   frontmatter-unknown-tag  (notice) — a tag is not in the canonical taxonomy
 *
 * Validates primary_tag + every entry in tags against the canonical `category>value`
 * taxonomy threaded onto ctx.taxonomy by the harness (checker/index.js, via
 * lib/taxonomy.js). FAIL-OPEN: when ctx.taxonomy is unavailable (null / not a Set /
 * empty) the rule emits nothing — this is the case whenever the tutorials-ims
 * PROD /build/tags feed hasn't been deployed yet or the fetch failed. Never blocks merge.
 */

// tutorial>beginner|intermediate|advanced is the experience/level tag; it is not
// part of the content taxonomy and is covered by frontmatter-missing-level-tag.
const LEVEL_TAG_RE = /^tutorial>(beginner|intermediate|advanced)$/i;

/** Collect candidate tags: primary_tag (single string) + tags (array). */
function collectTags(fm) {
  const out = [];
  if (typeof fm.primary_tag === "string" && fm.primary_tag.trim() !== "") {
    out.push(fm.primary_tag.trim());
  }
  if (Array.isArray(fm.tags)) {
    for (const t of fm.tags) {
      if (t == null) continue;
      const s = String(t).trim();
      if (s !== "") out.push(s);
    }
  }
  return out;
}

/**
 * Notice each tag that is not present in the canonical taxonomy.
 * Case-sensitive exact match on the full `category>value` string — the taxonomy is
 * lowercase-canonical and so are Hugo-emitted tags.
 */
function checkUnknownTag(ctx) {
  const valid = ctx.taxonomy;
  if (!(valid instanceof Set) || valid.size === 0) return []; // fail-open

  const findings = [];
  const seen = new Set();
  for (const tag of collectTags(ctx.frontmatter)) {
    if (LEVEL_TAG_RE.test(tag)) continue; // covered by frontmatter-missing-level-tag
    if (seen.has(tag)) continue; // primary_tag often repeats inside tags
    seen.add(tag);
    if (!valid.has(tag)) {
      findings.push({
        line: 1,
        severity: "notice",
        rule: "frontmatter-unknown-tag",
        message: `Tag not in canonical taxonomy: ${tag}`,
      });
    }
  }
  return findings;
}

export const tagRules = [checkUnknownTag];
