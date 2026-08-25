/**
 * checker/rules/body.js
 *
 * Body-structure rules: title, You-will-learn, Prerequisites, step headings.
 * Each rule is (ctx) => Finding[] returning partials {line, severity, rule, message}.
 *
 * Uses the fence helper so heading-looking lines inside code fences are ignored.
 */

import { buildFenceSet } from "../lib/fenced.js";

const SPECIAL_H2 = /^## (You will learn|Prerequisites)\s*$/;

/**
 * Find the 1-based line number of a pattern in the body, skipping fenced lines.
 * Returns the 1-based source line, or null if not found.
 */
function findBodyLine(ctx, pattern) {
  const bodyLines = ctx.body.split("\n");
  // Build fenced set relative to the full document lines so indices align.
  const fenced = buildFenceSet(ctx.lines);
  for (let i = 0; i < bodyLines.length; i++) {
    // body starts on the line after frontmatterEndLine (0-based)
    const sourceIdx = ctx.frontmatterEndLine + 1 + i; // 0-based index in ctx.lines
    if (fenced.has(sourceIdx)) continue;
    if (pattern.test(bodyLines[i])) {
      return sourceIdx + 1; // 1-based
    }
  }
  return null;
}

/** body-missing-title: no ^# heading in body AND no title in frontmatter */
function bodyMissingTitle(ctx) {
  const fenced = buildFenceSet(ctx.lines);
  const bodyLines = ctx.body.split("\n");
  let hasH1 = false;
  for (let i = 0; i < bodyLines.length; i++) {
    const sourceIdx = ctx.frontmatterEndLine + 1 + i;
    if (fenced.has(sourceIdx)) continue;
    if (/^# /.test(bodyLines[i])) {
      hasH1 = true;
      break;
    }
  }
  const hasTitle = Boolean(ctx.frontmatter.title);
  if (!hasH1 && !hasTitle) {
    return [{ line: 1, severity: "warning", rule: "body-missing-title", message: "Tutorial has no H1 heading and no title in frontmatter" }];
  }
  return [];
}

/** body-missing-you-will-learn: no ^## You will learn heading */
function bodyMissingYouWillLearn(ctx) {
  const line = findBodyLine(ctx, /^## You will learn\s*$/);
  if (line === null) {
    return [{ line: 1, severity: "notice", rule: "body-missing-you-will-learn", message: "Missing '## You will learn' section" }];
  }
  return [];
}

/** body-missing-prerequisites: no ^## Prerequisites heading */
function bodyMissingPrerequisites(ctx) {
  const line = findBodyLine(ctx, /^## Prerequisites\s*$/);
  if (line === null) {
    return [{ line: 1, severity: "notice", rule: "body-missing-prerequisites", message: "Missing '## Prerequisites' section" }];
  }
  return [];
}

/** body-no-steps: fewer than one ^## heading that is NOT You will learn / Prerequisites */
function bodyNoSteps(ctx) {
  const fenced = buildFenceSet(ctx.lines);
  const bodyLines = ctx.body.split("\n");
  let stepCount = 0;
  for (let i = 0; i < bodyLines.length; i++) {
    const sourceIdx = ctx.frontmatterEndLine + 1 + i;
    if (fenced.has(sourceIdx)) continue;
    if (/^## /.test(bodyLines[i]) && !SPECIAL_H2.test(bodyLines[i])) {
      stepCount++;
    }
  }
  if (stepCount < 1) {
    return [{ line: 1, severity: "warning", rule: "body-no-steps", message: "No step headings found (expected at least one '## ' heading that is not 'You will learn' or 'Prerequisites')" }];
  }
  return [];
}

export const bodyRules = [
  bodyMissingTitle,
  bodyMissingYouWillLearn,
  bodyMissingPrerequisites,
  bodyNoSteps,
];
