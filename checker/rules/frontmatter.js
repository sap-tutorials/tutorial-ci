/**
 * Frontmatter content-check rules.
 *
 * Rule ids:
 *   frontmatter-missing-field   (warning)  — required field absent/empty
 *   frontmatter-time-not-numeric (warning) — time present but has no digits / not finite
 *   frontmatter-merge-marker    (warning)  — git conflict marker in file
 *   frontmatter-yaml11-boolean  (warning)  — unquoted yes/no/on/off coerced by Hugo (YAML 1.1)
 *   frontmatter-empty-tags      (notice)   — tags present but empty array
 *   frontmatter-missing-level-tag (notice) — no tag matches tutorial>beginner|intermediate|advanced
 */

const REQUIRED_FIELDS = ["time", "author_name", "author_profile", "tags", "primary_tag"];

function isAbsentOrEmpty(val) {
  return val == null || val === "" || (Array.isArray(val) && val.length === 0);
}

/** Check required frontmatter fields are present and non-empty. */
function checkRequiredFields(ctx) {
  const findings = [];
  for (const field of REQUIRED_FIELDS) {
    if (isAbsentOrEmpty(ctx.frontmatter[field])) {
      findings.push({
        line: 1,
        severity: "warning",
        rule: "frontmatter-missing-field",
        message: `Required frontmatter field missing or empty: ${field}`,
      });
    }
  }
  return findings;
}

/**
 * Check that `time` can be coerced to a number.
 * Mirrors parsers/frontmatter.ts coerceTime: a string containing \d+ is OK.
 */
function checkTimeNumeric(ctx) {
  const { time } = ctx.frontmatter;
  if (time == null) return [];
  if (typeof time === "number") {
    if (!isFinite(time)) {
      return [{
        line: 1,
        severity: "warning",
        rule: "frontmatter-time-not-numeric",
        message: `time value is not a finite number`,
      }];
    }
    return [];
  }
  if (typeof time === "string") {
    if (!/\d+/.test(time)) {
      return [{
        line: 1,
        severity: "warning",
        rule: "frontmatter-time-not-numeric",
        message: `time value "${time}" contains no digits and cannot be coerced to a number`,
      }];
    }
    return [];
  }
  return [];
}

/** Surface git merge conflict markers so authors fix them before publishing. */
function checkMergeMarkers(ctx) {
  const findings = [];
  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    if (/^<<<<<<< /.test(line) || /^=======$/.test(line) || /^>>>>>>> /.test(line)) {
      findings.push({
        line: i + 1,
        severity: "warning",
        rule: "frontmatter-merge-marker",
        message: `Git merge conflict marker found: ${line.trimEnd()}`,
      });
    }
  }
  return findings;
}

/**
 * Detect unquoted yes/no/on/off values in the raw frontmatter block.
 * Hugo reads YAML 1.1 which coerces these to booleans — warn authors to quote them.
 * Detection is regex-based on raw lines (not parsed values) so it fires regardless
 * of which YAML lib parsed the frontmatter.
 */
function checkYaml11Boolean(ctx) {
  const findings = [];
  // fmLines = lines between the opening and closing ---
  const fmLines = ctx.lines.slice(1, ctx.frontmatterEndLine);
  for (let i = 0; i < fmLines.length; i++) {
    const line = fmLines[i];
    // Match: optional leading whitespace, a YAML key (word chars + hyphens), colon,
    // optional space, then exactly yes/no/on/off (case-insensitive), then end of line.
    // Quoted values ("no", 'no') will NOT match because they have surrounding quote chars.
    if (/^\s*[\w-]+:\s*(yes|no|on|off)\s*$/i.test(line)) {
      findings.push({
        line: i + 2, // i+1 = ctx.lines index; +1 for 1-based line number
        severity: "warning",
        rule: "frontmatter-yaml11-boolean",
        message: `Unquoted YAML 1.1 boolean value: "${line.trim()}" — Hugo coerces yes/no/on/off to boolean; quote the value`,
      });
    }
  }
  return findings;
}

/** Warn when tags is explicitly an empty array. */
function checkEmptyTags(ctx) {
  if (!("tags" in ctx.frontmatter)) return [];
  if (Array.isArray(ctx.frontmatter.tags) && ctx.frontmatter.tags.length === 0) {
    return [{
      line: 1,
      severity: "notice",
      rule: "frontmatter-empty-tags",
      message: "tags is an empty array; add at least one tag",
    }];
  }
  return [];
}

/**
 * Notice when no tag contains tutorial>beginner|intermediate|advanced.
 * The pipeline defaults to beginner but authors likely forgot to add the level tag.
 */
function checkLevelTag(ctx) {
  const tags = ctx.frontmatter.tags;
  if (!Array.isArray(tags) || tags.length === 0) return [];
  const hasLevel = tags.some((t) =>
    /tutorial>(beginner|intermediate|advanced)/i.test(String(t))
  );
  if (!hasLevel) {
    return [{
      line: 1,
      severity: "notice",
      rule: "frontmatter-missing-level-tag",
      message: "No tag contains tutorial>beginner|intermediate|advanced; level defaults to beginner",
    }];
  }
  return [];
}

export const frontmatterRules = [
  checkRequiredFields,
  checkTimeNumeric,
  checkMergeMarkers,
  checkYaml11Boolean,
  checkEmptyTags,
  checkLevelTag,
];
