/**
 * checker/rules/validation.js
 *
 * Validation-block rules: walk [VALIDATE_N] blocks (mirroring the parser's
 * block-boundary logic) and report structural problems that cause the runtime
 * to silently drop the block or behave unexpectedly.
 *
 * Also checks [AUTOAUTHOR_N:...] / [AUTOAUTHOR_ALL:...] suffix validity.
 *
 * Uses the fence helper so tokens inside code fences are ignored.
 */

import { buildFenceSet } from "../lib/fenced.js";

const MCQ_TYPES = new Set(["single-choice", "multiple-choice"]);
const KNOWN_RULE_TYPES = new Set(["single-choice", "multiple-choice", "regex", "regex-begins-with"]);
const KNOWN_AUTOAUTHOR_SUFFIXES = new Set(["mcq", "text"]);

// Matches [VALIDATE_N] block openers (any positive integer)
const VALIDATE_OPEN = /^\[VALIDATE_(\d+)\]\s*$/;

// Matches [AUTOAUTHOR_N:suffix] or [AUTOAUTHOR_ALL:suffix] (suffix required)
const AUTOAUTHOR_WITH_SUFFIX = /^\[AUTOAUTHOR_(?:\d+|ALL):([^\]]+)\]\s*$/;

// Matches ###Rule, ###Question, ###Match, ###Grading section headers inside a block
const SECTION_HEADER = /^###(Rule|Question|Match|Grading)\s*$/;

/**
 * Parse all [VALIDATE_N] blocks out of lines[], skipping fenced lines.
 * Returns an array of block objects:
 *   { startLine, rule, hasQuestion, hasMatch, matchLines, gradingValue }
 */
function parseValidateBlocks(lines, fenced) {
  const blocks = [];
  let current = null;
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    if (fenced.has(i)) {
      currentSection = null; // don't collect content inside fences
      continue;
    }
    const line = lines[i];

    if (VALIDATE_OPEN.test(line)) {
      // Start a new block
      current = {
        startLine: i + 1, // 1-based
        rule: "",
        hasQuestion: false,
        hasMatch: false,
        matchLines: [],
        gradingValue: "",
      };
      blocks.push(current);
      currentSection = null;
      continue;
    }

    if (!current) continue;

    const sectionMatch = SECTION_HEADER.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1]; // Rule | Question | Match | Grading
      continue;
    }

    // Check if we've hit the next block opener or end of content that signals block end
    // (blocks are delimited by the next [VALIDATE_N] or end of file)
    if (currentSection === "Rule" && line.trim()) {
      current.rule = line.trim();
      currentSection = null; // rule is a single line
    } else if (currentSection === "Question" && line.trim()) {
      current.hasQuestion = true;
    } else if (currentSection === "Match") {
      if (line.trim()) {
        current.hasMatch = true;
        current.matchLines.push(line);
      }
    } else if (currentSection === "Grading" && line.trim()) {
      current.gradingValue = line.trim();
    }
  }

  return blocks;
}

/**
 * validationRules — the exported array of rule functions for Task 5.
 */
function validateBlocks(ctx) {
  const fenced = buildFenceSet(ctx.lines);
  const blocks = parseValidateBlocks(ctx.lines, fenced);
  const findings = [];

  for (const block of blocks) {
    const isMcq = MCQ_TYPES.has(block.rule);
    const hasOptions = block.hasMatch;

    // validate-missing-question: block has no ###Question
    if (!block.hasQuestion) {
      findings.push({
        line: block.startLine,
        severity: "warning",
        rule: "validate-missing-question",
        message: `[VALIDATE] block at line ${block.startLine} has no ###Question — it will be silently dropped by the parser`,
      });
    }

    // validate-missing-answer: text-type block with no ###Match content
    if (!isMcq && !block.hasMatch) {
      findings.push({
        line: block.startLine,
        severity: "warning",
        rule: "validate-missing-answer",
        message: `[VALIDATE] text-type block at line ${block.startLine} has no ###Match content — it will be silently dropped by the parser`,
      });
    }

    // validate-mcq-no-correct: MCQ block with zero [x]/[X] markers
    if (isMcq) {
      const hasCorrect = block.matchLines.some((l) => /\[\s*[xX]\s*\]/.test(l));
      if (!hasCorrect) {
        findings.push({
          line: block.startLine,
          severity: "warning",
          rule: "validate-mcq-no-correct",
          message: `[VALIDATE] MCQ block at line ${block.startLine} has no correct answer ([x]) — runtime will have no correct option`,
        });
      }
    }

    // validate-mcq-ai-judged-footgun: MCQ block with ###Grading: ai-judged
    if (isMcq && block.gradingValue === "ai-judged") {
      findings.push({
        line: block.startLine,
        severity: "warning",
        rule: "validate-mcq-ai-judged-footgun",
        message: `[VALIDATE] MCQ block at line ${block.startLine} uses ###Grading: ai-judged — runtime rejects with wrong_question_type`,
      });
    }

    // validate-unknown-rule-type: ###Rule value non-empty and NOT in known set,
    // when block has options/match
    if (block.rule && !KNOWN_RULE_TYPES.has(block.rule) && hasOptions) {
      findings.push({
        line: block.startLine,
        severity: "notice",
        rule: "validate-unknown-rule-type",
        message: `[VALIDATE] block at line ${block.startLine} has unknown ###Rule type '${block.rule}' (expected: single-choice, multiple-choice, regex, regex-begins-with)`,
      });
    }
  }

  return findings;
}

/**
 * autoauthorUnknownSuffix: any [AUTOAUTHOR_N:...] / [AUTOAUTHOR_ALL:...]
 * with a suffix other than mcq/text.
 */
function autoauthorUnknownSuffix(ctx) {
  const fenced = buildFenceSet(ctx.lines);
  const findings = [];

  for (let i = 0; i < ctx.lines.length; i++) {
    if (fenced.has(i)) continue;
    const line = ctx.lines[i];
    const m = AUTOAUTHOR_WITH_SUFFIX.exec(line);
    if (m) {
      const suffix = m[1].trim();
      if (!KNOWN_AUTOAUTHOR_SUFFIXES.has(suffix)) {
        findings.push({
          line: i + 1,
          severity: "notice",
          rule: "autoauthor-unknown-suffix",
          message: `[AUTOAUTHOR] directive at line ${i + 1} has unrecognized suffix '${suffix}' (expected: mcq, text) — the suffix is silently ignored by the parser`,
        });
      }
    }
  }

  return findings;
}

export const validationRules = [validateBlocks, autoauthorUnknownSuffix];
