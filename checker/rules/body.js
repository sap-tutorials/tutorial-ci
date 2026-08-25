/**
 * checker/rules/body.js
 *
 * Body-structure rules: title, You-will-learn, Prerequisites, step headings.
 * Each rule is (ctx) => Finding[] returning partials {line, severity, rule, message}.
 */

const SPECIAL_H2 = /^## (You will learn|Prerequisites)\s*$/;

/**
 * Find the 1-based line number of a pattern in the body.
 * body is the frontmatter-stripped content string.
 * frontmatterEndLine is the 0-based index of the closing "---" line.
 * Returns the 1-based source line, or null if not found.
 */
function findBodyLine(ctx, pattern) {
  const bodyLines = ctx.body.split("\n");
  for (let i = 0; i < bodyLines.length; i++) {
    if (pattern.test(bodyLines[i])) {
      // body starts on the line after frontmatterEndLine (0-based), so:
      // source line = (frontmatterEndLine + 1) + i + 1  (1-based)
      return ctx.frontmatterEndLine + 1 + i + 1;
    }
  }
  return null;
}

/** body-missing-title: no ^# heading in body AND no title in frontmatter */
function bodyMissingTitle(ctx) {
  const hasH1 = /^# /m.test(ctx.body);
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
  const bodyLines = ctx.body.split("\n");
  const stepHeadings = bodyLines.filter((l) => /^## /.test(l) && !SPECIAL_H2.test(l));
  if (stepHeadings.length < 1) {
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
