import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { pathRules } from "../rules/paths.js";
const pth = (name) => runChecks("---\ntitle: X\n---\n# X\n", name, pathRules).map((f) => f.rule);

test("uppercase in the slug path is flagged", () => {
  expect(pth("tutorials/MyTutorial/MyTutorial.md")).toContain("path-uppercase-slug");
});

test("markdown outside tutorials/<slug>/ is flagged", () => {
  expect(pth("readme-extra.md")).toContain("path-wrong-location");
});
