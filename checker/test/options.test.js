import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { optionRules } from "../rules/options.js";
const opt = (md) => runChecks(md, "tutorials/x/x.md", optionRules).map((f) => f.rule);

test("OPTION BEGIN without a matching END is unbalanced", () => {
  expect(opt("[OPTION BEGIN [Java]]\nsome content\n")).toContain("option-unbalanced");
});

test("balanced OPTION block does not flag", () => {
  expect(opt("[OPTION BEGIN [Java]]\nx\n[OPTION END]\n")).not.toContain("option-unbalanced");
});

test("OPTION BEGIN missing the [TabName] is flagged", () => {
  expect(opt("[OPTION BEGIN []]\nx\n[OPTION END]\n")).toContain("option-missing-tabname");
});

test("OPTION BEGIN bare form (no brackets) is flagged as missing tabname", () => {
  expect(opt("[OPTION BEGIN ]\nx\n[OPTION END]\n")).toContain("option-missing-tabname");
});

test("OPTION BEGIN bare form still counts for balance", () => {
  expect(opt("[OPTION BEGIN ]\nx\n[OPTION END]\n")).not.toContain("option-unbalanced");
});
