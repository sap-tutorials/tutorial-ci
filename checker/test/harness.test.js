import { test, expect } from "vitest";
import { runChecks } from "../index.js";

test("runChecks returns [] for empty rule set on clean input", () => {
  const md = "---\ntitle: X\n---\n# X\n";
  expect(runChecks(md, "tutorials/x/x.md")).toEqual([]);
});

test("a registered rule receives parsed context and its findings carry file+category", () => {
  const md = "---\ntitle: X\n---\n# X\n";
  const findings = runChecks(md, "tutorials/x/x.md", [
    (ctx) => [{ line: 1, severity: "warning", rule: "probe", message: ctx.filename }],
  ]);
  expect(findings[0]).toEqual({ category: "content", file: "tutorials/x/x.md", line: 1, severity: "warning", rule: "probe", message: "tutorials/x/x.md" });
});
