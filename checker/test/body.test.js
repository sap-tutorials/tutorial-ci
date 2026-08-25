import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { bodyRules } from "../rules/body.js";
const check = (md) => runChecks(md, "tutorials/x/x.md", bodyRules).map((f) => f.rule);

const FM = "---\ntime: 5\nauthor_name: A\nauthor_profile: https://github.com/a\ntags: [tutorial>beginner]\nprimary_tag: t\n---\n";

test("no H1 and no title frontmatter → missing title", () => {
  expect(check(FM + "some text\n")).toContain("body-missing-title");
});

test("H1 present → no missing-title", () => {
  expect(check(FM + "# Hello\n## You will learn\n- a\n## Prerequisites\nnone\n## Step 1\nx\n")).not.toContain("body-missing-title");
});

test("missing You will learn and Prerequisites are reported", () => {
  const r = check(FM + "# Hello\n## Step 1\nx\n");
  expect(r).toContain("body-missing-you-will-learn");
  expect(r).toContain("body-missing-prerequisites");
});

test("no step headings → body-no-steps", () => {
  expect(check(FM + "# Hello\n## You will learn\n- a\n## Prerequisites\nnone\n")).toContain("body-no-steps");
});
