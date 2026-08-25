import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { optionRules } from "../rules/options.js";
import { pathRules } from "../rules/paths.js";
const opt = (md) => runChecks(md, "tutorials/x/x.md", optionRules).map((f) => f.rule);
const pth = (name) => runChecks("---\ntitle: X\n---\n# X\n", name, pathRules).map((f) => f.rule);

test("OPTION BEGIN without a matching END is unbalanced", () => {
  expect(opt("[OPTION BEGIN [Java]]\nsome content\n")).toContain("option-unbalanced");
});

test("balanced OPTION block does not flag", () => {
  expect(opt("[OPTION BEGIN [Java]]\nx\n[OPTION END]\n")).not.toContain("option-unbalanced");
});

test("OPTION BEGIN missing the [TabName] is flagged", () => {
  expect(opt("[OPTION BEGIN []]\nx\n[OPTION END]\n")).toContain("option-missing-tabname");
});

test("uppercase in the slug path is flagged", () => {
  expect(pth("tutorials/MyTutorial/MyTutorial.md")).toContain("path-uppercase-slug");
});

test("markdown outside tutorials/<slug>/ is flagged", () => {
  expect(pth("readme-extra.md")).toContain("path-wrong-location");
});
