/**
 * options.js — Options-block balance and tab-name rules.
 *
 * Rule ids: option-unbalanced, option-missing-tabname
 *
 * NOTE: mirrors the parser — OPTION block matching is NOT fence-aware
 * (the parser matches globally), so we do the same here.
 */

/**
 * @param {import("../index.js").Context} ctx
 * @returns {import("../index.js").FindingPartial[]}
 */
function checkOptions(ctx) {
  const findings = [];
  const begins = [];
  let endCount = 0;

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const lineNum = i + 1;

    // Match [OPTION BEGIN [...]] — capture everything inside the outer brackets
    const beginMatch = line.match(/^\[OPTION BEGIN(\s*\[([^\]]*)\])?\]/);
    if (beginMatch) {
      const tabName = beginMatch[2]; // contents inside inner [...]
      begins.push({ lineNum, tabName: tabName === undefined ? null : tabName });
      continue;
    }

    if (/^\[OPTION END\]/.test(line)) {
      endCount++;
    }
  }

  // Check for missing tab names
  for (const begin of begins) {
    if (begin.tabName === null || begin.tabName === undefined || begin.tabName.trim() === "") {
      findings.push({
        line: begin.lineNum,
        severity: "warning",
        rule: "option-missing-tabname",
        message: "[OPTION BEGIN] is missing a tab name — use [OPTION BEGIN [TabName]]",
      });
    }
  }

  // Check balance
  if (begins.length !== endCount) {
    // Find the line of the first unmatched BEGIN (or first line as fallback)
    const unmatchedLine = begins[endCount] ? begins[endCount].lineNum : (begins[0] ? begins[0].lineNum : 1);
    findings.push({
      line: unmatchedLine,
      severity: "warning",
      rule: "option-unbalanced",
      message: `[OPTION BEGIN] count (${begins.length}) does not match [OPTION END] count (${endCount})`,
    });
  }

  return findings;
}

export const optionRules = [checkOptions];
