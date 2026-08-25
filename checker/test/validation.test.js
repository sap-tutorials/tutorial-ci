import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { validationRules } from "../rules/validation.js";
const check = (md) => runChecks(md, "tutorials/x/x.md", validationRules).map((f) => f.rule);

test("VALIDATE block without ###Question is flagged (would be silently dropped)", () => {
  expect(check("[VALIDATE_1]\n###Rule\nregex\n###Match\nfoo\n")).toContain("validate-missing-question");
});

test("text VALIDATE block without ###Match is flagged", () => {
  expect(check("[VALIDATE_1]\n###Question\nWhat?\n")).toContain("validate-missing-answer");
});

test("single-choice with zero [x] options is flagged", () => {
  expect(check("[VALIDATE_1]\n###Rule\nsingle-choice\n###Question\nQ\n###Match\n[ ] a\n[ ] b\n")).toContain("validate-mcq-no-correct");
});

test("MCQ marked ai-judged is a footgun warning", () => {
  const md = "[VALIDATE_1]\n###Rule\nmultiple-choice\n###Question\nQ\n###Grading\nai-judged\n###Match\n[x] a\n[ ] b\n";
  expect(check(md)).toContain("validate-mcq-ai-judged-footgun");
});

test("unrecognized rule type warns", () => {
  expect(check("[VALIDATE_1]\n###Rule\nfuzzy-match\n###Question\nQ\n###Match\nfoo\n")).toContain("validate-unknown-rule-type");
});

test("AUTOAUTHOR with a bad suffix warns", () => {
  expect(check("[AUTOAUTHOR_2:essay]\n")).toContain("autoauthor-unknown-suffix");
});
