import { test, expect } from "vitest";
import { isTargetRepo, EXCLUDED_REPOS } from "../scripts/list-target-repos.js";

// Enumeration keys off tutorial CONTENT (a `tutorials/` dir), not CircleCI —
// the orb is being removed and is not a reliable signal. isTargetRepo (orb)
// is retained for reference; hasTutorialsDir hits the GitHub API so is
// exercised live by the rollout dry-run rather than here.
test("repo referencing the tutorial-checker orb is a target", () => {
  expect(isTargetRepo("orbs:\n  x: saptutorials/tutorial-checker@1.0.0\n")).toBe(true);
});
test("repo with no orb reference is not a target", () => {
  expect(isTargetRepo("version: 2.1\njobs: {}\n")).toBe(false);
});
test("missing circleci config is not a target", () => {
  expect(isTargetRepo(null)).toBe(false);
});

test("tooling/template/infra repos are excluded from rollout", () => {
  for (const name of ["tutorial-ci", "tutorial-checker", "tutorial-checker-orb",
                      "tutorial-actions", "repository-template", "tutorial-repo-template",
                      "tutorial-repo-Contribution-template", ".github"]) {
    expect(EXCLUDED_REPOS.has(name)).toBe(true);
  }
});
test("a normal content repo is not in the exclude set", () => {
  expect(EXCLUDED_REPOS.has("btp-foundation")).toBe(false);
  expect(EXCLUDED_REPOS.has("btp-foundation-Contribution")).toBe(false);
});
