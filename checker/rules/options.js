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
  const ends = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    const line = ctx.lines[i];
    const lineNum = i + 1;

    // Match [OPTION BEGIN [TabName]], [OPTION BEGIN []], or [OPTION BEGIN ]
    // The bracket group is fully optional; trailing space before ] is tolerated.
    const beginMatch = line.match(/^\[OPTION BEGIN(?:\s*\[([^\]]*)\])?\s*\]/);
    if (beginMatch) {
      const tabName = beginMatch[1]; // undefined when no [...] present
      begins.push({ lineNum, tabName: tabName === undefined ? null : tabName });
      continue;
    }

    if (/^\[OPTION END\]/.test(line)) {
      ends.push(lineNum);
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
  if (begins.length !== ends.length) {
    let unmatchedLine;
    if (begins.length > ends.length) {
      // More BEGINs than ENDs — report first unmatched BEGIN
      unmatchedLine = begins[ends.length] ? begins[ends.length].lineNum : begins[0].lineNum;
    } else {
      // More ENDs than BEGINs — report first stray END
      unmatchedLine = ends[begins.length] !== undefined ? ends[begins.length] : ends[0];
    }
    findings.push({
      line: unmatchedLine,
      severity: "warning",
      rule: "option-unbalanced",
      message: `[OPTION BEGIN] count (${begins.length}) does not match [OPTION END] count (${ends.length})`,
    });
  }

  return findings;
}

export const optionRules = [checkOptions];
