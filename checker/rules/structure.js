/**
 * checker/rules/structure.js
 *
 * Parser-faithful structural rules that mirror the tutorials-ims content
 * pipeline (scripts/parsers/compose.ts + intro.ts). They catch the exact
 * class of defect that makes a tutorial unpublishable: the publish guard
 * rejects any tutorial whose parsed `stepCount` is 0 ("Invalid 'stepCount'
 * value: 0"), and a full rebuild silently skips it ("empty-step skipped").
 * By the time that surfaces, the malformed markdown is already merged — these
 * rules block it at PR time instead.
 *
 * Unlike the heuristic body-no-steps rule (which counts H2 headings and so
 * gives a false PASS for a file full of `## Exercise ...` headings and no
 * frontmatter), these rules reproduce the pipeline's REAL step-detection:
 *
 *   const isV2 = frontmatter.parser === 'v2'
 *   step delimiter = isV2 ? /^### /  :  /\[ACCORDION-BEGIN \[Step \d+:\s*\]\(.+?\)\]/
 *
 * evaluated on CRLF-normalized (compose.normalizeLineEndings) fence-aware lines.
 *
 * Rule ids / severities:
 *   structure-no-frontmatter  (error)   -- no YAML frontmatter block at all
 *   structure-unknown-parser  (warning) -- `parser` set to something other than v2
 *   structure-zero-steps      (error)   -- file parses to 0 steps (unpublishable)
 *
 * The two `error` rules are the ONLY blocking checks in tutorial-ci; the
 * workflow gate (scripts/gate-blocking.js) fails the PR check when either
 * fires. Every other rule/tool stays notify-only.
 */

import { buildFenceSet } from "../lib/fenced.js";

// Mirrors scripts/parsers/intro.ts V1_STEP (legacy ACCORDION step marker).
const V1_STEP = /\[ACCORDION-BEGIN \[Step \d+:\s*\]\(.+?\)\]/;
// Mirrors the v2 step delimiter (an H3 heading).
const V2_STEP = /^### /;

/**
 * Count parsed steps exactly as the pipeline does.
 * @returns {{ isV2: boolean, stepCount: number, h3Count: number }}
 *   - CRLF/CR normalized to LF so `^### ` matches on Windows checkouts.
 *   - Fence-aware: delimiters inside ``` / ~~~ blocks are ignored.
 *   - h3Count is reported separately so the zero-steps message can tell an
 *     author who HAS `### ` headings but forgot `parser: v2` what went wrong.
 */
function countSteps(ctx) {
  const isV2 = ctx.frontmatter.parser === "v2";
  // Recompute from the raw body with LF normalization (ctx.body may carry \r).
  const bodyLines = String(ctx.body).replace(/\r\n?/g, "\n").split("\n");
  const fenced = buildFenceSet(bodyLines);

  let stepCount = 0;
  let h3Count = 0;
  for (let i = 0; i < bodyLines.length; i++) {
    if (fenced.has(i)) continue;
    const line = bodyLines[i];
    if (V2_STEP.test(line)) h3Count++;
    if (isV2 ? V2_STEP.test(line) : V1_STEP.test(line)) stepCount++;
  }
  return { isV2, stepCount, h3Count };
}

/**
 * structure-no-frontmatter (error): the file has no YAML frontmatter block.
 * parseContext sets frontmatterEndLine to 0 when the document does not open
 * with `---` (or never closes the fence). Without frontmatter the pipeline has
 * no `parser`, `tags`, `time`, etc. and cannot classify or render the tutorial.
 */
function checkFrontmatterPresent(ctx) {
  if (ctx.frontmatterEndLine > 0) return [];
  return [{
    line: 1,
    severity: "error",
    rule: "structure-no-frontmatter",
    message:
      "Tutorial has no YAML frontmatter block -- the pipeline reads parser, tags and time from frontmatter and cannot classify or render this file. Add a `---` fenced frontmatter block (at least `parser: v2`, `tags`, `primary_tag`, `time`).",
  }];
}

/**
 * structure-unknown-parser (warning): `parser` is present but not `v2`.
 * Absence is fine (legacy v1 tutorials omit it). Any non-v2 value silently
 * routes the file down the v1 path, where `### ` headings are NOT steps -- a
 * subtle footgun, so warn (but don't block, since v1 with ACCORDION is valid).
 */
function checkParserValue(ctx) {
  const p = ctx.frontmatter.parser;
  if (p == null) return [];
  if (p === "v2") return [];
  return [{
    line: 1,
    severity: "warning",
    rule: "structure-unknown-parser",
    message:
      `Unrecognized parser "${p}" -- the pipeline only recognizes \`parser: v2\`; any other value is treated as legacy v1 (### headings are NOT steps). Use \`parser: v2\`, or remove the field for a legacy ACCORDION tutorial.`,
  }];
}

/**
 * structure-zero-steps (error): the file parses to 0 steps and so is rejected
 * by the publish guard / silently skipped by a full rebuild. The message is
 * tailored to WHY it is zero so the author can fix it in one edit.
 */
function checkStepCount(ctx) {
  const { isV2, stepCount, h3Count } = countSteps(ctx);
  if (stepCount > 0) return [];

  let message;
  if (isV2) {
    message =
      "Tutorial parses to 0 steps: `parser: v2` is set but no `### ` (H3) step headings were found. In v2, each step is an H3 heading (`### Step title`).";
  } else if (h3Count > 0) {
    message =
      `Tutorial parses to 0 steps: ${h3Count} \`### \` (H3) heading(s) found, but the frontmatter is missing \`parser: v2\`, so the pipeline treats this file as legacy v1 and looks for \`[ACCORDION-BEGIN [Step N:...]]\` markers instead. Add \`parser: v2\` to the frontmatter.`;
  } else {
    message =
      "Tutorial parses to 0 steps: no `[ACCORDION-BEGIN [Step N:...]]` markers found (legacy v1) and no `parser: v2` frontmatter. A tutorial with 0 steps is rejected by the publish guard and skipped by a full rebuild.";
  }
  return [{ line: 1, severity: "error", rule: "structure-zero-steps", message }];
}

export const structureRules = [checkFrontmatterPresent, checkParserValue, checkStepCount];
