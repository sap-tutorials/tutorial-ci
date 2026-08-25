import { test, expect } from "vitest";
import { isTargetRepo } from "../scripts/list-target-repos.js";

test("repo referencing the tutorial-checker orb is a target", () => {
  expect(isTargetRepo("orbs:\n  x: saptutorials/tutorial-checker@1.0.0\n")).toBe(true);
});
test("repo with no orb reference is not a target", () => {
  expect(isTargetRepo("version: 2.1\njobs: {}\n")).toBe(false);
});
test("missing circleci config is not a target", () => {
  expect(isTargetRepo(null)).toBe(false);
});
