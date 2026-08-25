import { readFileSync } from "node:fs";
import { test, expect } from "vitest";
import { runChecks } from "../index.js";

/**
 * Task 7: Real-tutorial regression fixtures.
 *
 * good-sample.md — btp-foundation/btp-cf-buildpacks-node-create, a real published
 * tutorial fetched verbatim. The test calls runChecks() with the DEFAULT allRules
 * (no explicit rules arg) — this is the previously-uncovered default code path.
 *
 * bad-sample.md — same tutorial with `time: soon` substituted for `time: 45`.
 * That introduces a frontmatter-time-not-numeric warning.
 */

test("a known-good published tutorial produces zero warnings", () => {
  const md = readFileSync(new URL("./fixtures/good-sample.md", import.meta.url), "utf8");
  const warnings = runChecks(md, "tutorials/good-sample/good-sample.md").filter(
    (f) => f.severity === "warning"
  );
  // If this fails, a rule is too strict — fix the rule, not the fixture.
  expect(warnings).toEqual([]);
});

test("the known-bad fixture produces at least one finding", () => {
  const md = readFileSync(new URL("./fixtures/bad-sample.md", import.meta.url), "utf8");
  expect(runChecks(md, "tutorials/bad-sample/bad-sample.md").length).toBeGreaterThan(0);
});
