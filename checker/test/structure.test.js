import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { structureRules } from "../rules/structure.js";

const check = (md) => runChecks(md, "tutorials/x/x.md", structureRules);
const rules = (md) => check(md).map((f) => f.rule);

const FM_V2 = "---\nparser: v2\ntime: 5\ntags: [tutorial>beginner]\nprimary_tag: t\n---\n";

// ── frontmatter presence ───────────────────────────────────────────────────
test("no frontmatter -> structure-no-frontmatter (error)", () => {
  const r = check("# Title\n## Introduction\nx\n## Exercise 1.1\ny\n");
  const nf = r.find((f) => f.rule === "structure-no-frontmatter");
  expect(nf).toBeTruthy();
  expect(nf.severity).toBe("error");
});

test("frontmatter present -> no structure-no-frontmatter", () => {
  expect(rules(FM_V2 + "# T\n### Step one\nx\n")).not.toContain("structure-no-frontmatter");
});

// ── the exact abap-dev-adt-mcp-server-tools shape: no FM + H2 'exercises' ────
test("regression: no frontmatter + H2 exercise headings -> zero-steps + no-frontmatter (both error)", () => {
  const md =
    "# Exercise: Enable the ADT MCP Server\n" +
    "## Introduction\ntext\n" +
    "## About the ADT MCP Server\ntext\n" +
    "## Exercise 1.1: Do a thing\nsteps\n" +
    "## Exercise 1.2: Do another\nsteps\n" +
    "## Summary & Next Exercise\nbye\n";
  const errs = check(md).filter((f) => f.severity === "error").map((f) => f.rule).sort();
  expect(errs).toEqual(["structure-no-frontmatter", "structure-zero-steps"]);
});

// ── valid v2 ────────────────────────────────────────────────────────────────
test("v2 with ### steps -> no structural errors", () => {
  const r = check(FM_V2 + "# T\n## You will learn\n- a\n### Step 1\nx\n### Step 2\ny\n");
  expect(r.filter((f) => f.severity === "error")).toEqual([]);
});

// ── valid legacy v1 (no parser, ACCORDION steps) ────────────────────────────
test("legacy v1 with ACCORDION steps -> no structural errors", () => {
  const FM_V1 = "---\ntime: 5\ntags: [tutorial>beginner]\nprimary_tag: t\n---\n";
  const md =
    FM_V1 +
    "# T\n" +
    "[ACCORDION-BEGIN [Step 1: ](Do the first thing)]\nx\n[ACCORDION-END]\n" +
    "[ACCORDION-BEGIN [Step 2: ](Do the second)]\ny\n[ACCORDION-END]\n";
  expect(check(md).filter((f) => f.severity === "error")).toEqual([]);
});

// ── v2 declared but no ### steps -> zero-steps ──────────────────────────────
test("parser: v2 but only ## headings -> structure-zero-steps (error)", () => {
  const r = check(FM_V2 + "# T\n## You will learn\n- a\n## Not a step\nx\n");
  const zs = r.find((f) => f.rule === "structure-zero-steps");
  expect(zs).toBeTruthy();
  expect(zs.severity).toBe("error");
  expect(zs.message).toContain("parser: v2");
});

// ── the sneaky one: ### steps present but parser NOT set -> zero-steps + hint ─
test("### headings present but parser missing -> zero-steps with 'Add parser: v2' hint", () => {
  const FM_NOPARSER = "---\ntime: 5\ntags: [tutorial>beginner]\nprimary_tag: t\n---\n";
  const r = check(FM_NOPARSER + "# T\n### Step 1\nx\n### Step 2\ny\n");
  const zs = r.find((f) => f.rule === "structure-zero-steps");
  expect(zs).toBeTruthy();
  expect(zs.severity).toBe("error");
  expect(zs.message).toContain("Add `parser: v2`");
});

// ── unknown parser value -> warning (not blocking) ──────────────────────────
test("parser: v3 -> structure-unknown-parser warning (not error)", () => {
  const FM_V3 = "---\nparser: v3\ntime: 5\ntags: [tutorial>beginner]\nprimary_tag: t\n---\n";
  const r = check(FM_V3 + "# T\n### Step 1\nx\n");
  const up = r.find((f) => f.rule === "structure-unknown-parser");
  expect(up).toBeTruthy();
  expect(up.severity).toBe("warning");
});

// ── fence-aware: ### inside a code fence is NOT a step ───────────────────────
test("### inside a code fence does not count as a v2 step", () => {
  const md = FM_V2 + "# T\n```md\n### Not a real step\n```\n";
  expect(rules(md)).toContain("structure-zero-steps");
});

// ── CRLF v2 still counts steps (mirrors compose.normalizeLineEndings) ───────
test("CRLF-terminated v2 ### steps are counted (no false zero-steps)", () => {
  const md = (FM_V2 + "# T\n### Step 1\nx\n### Step 2\ny\n").replace(/\n/g, "\r\n");
  expect(rules(md)).not.toContain("structure-zero-steps");
});
