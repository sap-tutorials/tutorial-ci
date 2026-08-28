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

// Split a tag list on commas that are NOT preceded by a backslash — the SAP `\,`
// escaped-comma convention keeps a literal comma inside a SINGLE tag value (e.g.
// `software-product-function>sap-hana-cloud\,-data-lake` is ONE tag). This mirrors
// the tutorial parser's own split (`frontmatter-utils.ts`: /(?<!\\),/).
const ESCAPED_COMMA_SPLIT = /(?<!\\),/;

/** Strip a single pair of surrounding single/double quotes, if present. */
function stripQuotes(s) {
  if (
    s.length >= 2 &&
    ((s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/** Split a raw flow-sequence inner string into trimmed, unquoted, non-empty tokens. */
function splitFlowInner(inner) {
  return inner
    .split(ESCAPED_COMMA_SPLIT)
    .map((s) => stripQuotes(s.trim()))
    .filter((s) => s !== "");
}

/**
 * Extract the `tags:` list from the RAW frontmatter YAML source, splitting on the
 * ESCAPE-AWARE comma so `\,` stays inside one tag value. gray-matter/js-yaml splits
 * a flow-sequence on the escaped comma and drops the backslash, yielding phantom
 * tokens (e.g. `sap-hana-cloud\,-data-lake` → `["…sap-hana-cloud", "-data-lake"]`)
 * that then false-flag as unknown tags — this bypasses that.
 *
 * Handles both the inline flow form (`tags: [ a, b\,c ]`, possibly wrapped across
 * lines) and the block-list form (`tags:` then `  - a`). Each token is returned
 * INCLUDING its `\,`; toValueKey() strips the backslash during normalization.
 *
 * Returns an array of raw tag strings, or null when no `tags:` key is found (callers
 * then fall back to ctx.frontmatter.tags — the previous behavior).
 *
 * @param {string} frontmatterRaw raw YAML between the "---" fences
 * @returns {string[]|null}
 */
export function parseTagsEscapeAware(frontmatterRaw) {
  if (typeof frontmatterRaw !== "string" || frontmatterRaw === "") return null;
  const lines = frontmatterRaw.split("\n");

  // A top-level `tags:` key (no leading indentation — nested `tags:` is out of scope).
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^tags[ \t]*:/.test(lines[i])) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return null;

  const afterColon = lines[idx].slice(lines[idx].indexOf(":") + 1).trim();

  // Flow form: `tags: [ ... ]`, possibly spanning multiple lines.
  if (afterColon.startsWith("[")) {
    let buf = afterColon;
    let j = idx;
    while (!buf.includes("]") && j + 1 < lines.length) {
      j++;
      buf += "\n" + lines[j];
    }
    const open = buf.indexOf("[");
    const close = buf.lastIndexOf("]");
    if (close <= open) return null; // malformed — fall back
    return splitFlowInner(buf.slice(open + 1, close));
  }

  // Block-list form: `tags:` followed by `  - item` lines.
  if (afterColon === "") {
    const items = [];
    for (let j = idx + 1; j < lines.length; j++) {
      const m = /^[ \t]*-[ \t]+(.*)$/.exec(lines[j]);
      if (!m) break; // first non-list line ends the block sequence
      const v = stripQuotes(m[1].trim());
      if (v !== "") items.push(v);
    }
    return items;
  }

  // Some other scalar/unsupported shape — let the caller fall back.
  return null;
}

/**
 * Collect candidate tags: primary_tag (single string) + tags (array).
 *
 * primary_tag is read from the gray-matter scalar (a scalar is not comma-split, so it
 * parses intact). The tags LIST is derived escape-aware from the raw frontmatter to
 * survive the `\,` convention; if the raw `tags:` line can't be located we fall back to
 * the gray-matter-parsed ctx.frontmatter.tags (previous behavior).
 */
function collectTags(ctx) {
  const fm = ctx.frontmatter ?? {};
  const out = [];
  if (typeof fm.primary_tag === "string" && fm.primary_tag.trim() !== "") {
    out.push(fm.primary_tag.trim());
  }

  const rawTags = parseTagsEscapeAware(ctx.frontmatterRaw);
  const tags = rawTags ?? (Array.isArray(fm.tags) ? fm.tags : []);
  for (const t of tags) {
    if (t == null) continue;
    const s = String(t).trim();
    if (s !== "") out.push(s);
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
  for (const tag of collectTags(ctx)) {
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
