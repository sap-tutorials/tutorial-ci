/**
 * Tag taxonomy content-check rules.
 *
 * Rule ids:
 *   frontmatter-unknown-tag  (notice) — a tag's VALUE is not in the canonical taxonomy
 *
 * Validates primary_tag + every entry in tags against the canonical taxonomy threaded
 * onto ctx.taxonomy by the harness (checker/index.js, via lib/taxonomy.js).
 *
 * MATCH ON THE VALUE SLUG, NOT the full `category>value`. This mirrors the tutorial
 * parser (`frontmatter-utils.ts` does `raw.split('>').pop()` — it ignores the category
 * entirely) and the mdFormat normalizer that produces the feed values. Matching the
 * full `category>value` was STRICTER than the parser and fired nuisance notices on
 * legacy category prefixes (e.g. `products>sap-hana` when the taxonomy carries the same
 * product under `software-product>sap-hana`) and on comma/escape display-forms.
 *
 * FAIL-OPEN: when ctx.taxonomy is unavailable (null / not a Set / empty) the rule emits
 * nothing — this is the case whenever the tutorials-ims PROD /build/tags feed hasn't
 * been deployed yet or the fetch failed. Never blocks merge.
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
 * Derive the comparison key for a tag: take the VALUE (substring after the last `>`,
 * or the whole string when there is no `>` — malformed tags like `tutorial:how-to`
 * then keep their whole form and correctly fail to match), then normalize IDENTICALLY
 * to mdFormat: strip backslashes, replace every non-alphanumeric with `-`, lowercase.
 */
function toValueKey(tag) {
  const value = tag.includes(">") ? tag.slice(tag.lastIndexOf(">") + 1) : tag;
  return value
    .replace(/\\/g, "")
    .replace(/[^A-Za-z\d]/g, "-")
    .toLowerCase();
}

/**
 * Build the set of valid VALUE slugs from the canonical `category>value` taxonomy.
 * The feed values are already mdFormat-normalized (titlePath → mdFormat), so we only
 * take the substring after the last `>`.
 */
function validValueSet(taxonomy) {
  const values = new Set();
  for (const entry of taxonomy) {
    if (typeof entry !== "string" || entry.length === 0) continue;
    values.add(entry.split(">").pop());
  }
  return values;
}

/**
 * Notice each tag whose normalized VALUE is not present in the canonical taxonomy.
 * The message names the ORIGINAL frontmatter tag (not the normalized form) so authors
 * recognize what to fix.
 */
function checkUnknownTag(ctx) {
  const valid = ctx.taxonomy;
  if (!(valid instanceof Set) || valid.size === 0) return []; // fail-open

  const validValues = validValueSet(valid);
  if (validValues.size === 0) return []; // fail-open

  const findings = [];
  const seen = new Set();
  for (const tag of collectTags(ctx.frontmatter)) {
    if (LEVEL_TAG_RE.test(tag)) continue; // covered by frontmatter-missing-level-tag
    if (seen.has(tag)) continue; // primary_tag often repeats inside tags
    seen.add(tag);
    if (!validValues.has(toValueKey(tag))) {
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
