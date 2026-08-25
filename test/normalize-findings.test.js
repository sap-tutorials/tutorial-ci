import { describe, test, expect } from "vitest";
import { normalizeFindings, renderAnnotations, renderComment } from "../scripts/normalize-findings.js";

describe("normalizeFindings", () => {
  test("maps markdownlint-cli2 jsonl to findings", () => {
    const markdownlint = [{ fileName: "a.md", lineNumber: 3, ruleNames: ["MD009"], ruleDescription: "Trailing spaces" }];
    const out = normalizeFindings({ markdownlint, gitleaks: [], lychee: [] });
    expect(out).toEqual([{ category: "markdown", file: "a.md", line: 3, severity: "warning", rule: "MD009", message: "Trailing spaces" }]);
  });

  test("maps gitleaks report entries to secret findings", () => {
    const gitleaks = [{ File: "b.md", StartLine: 5, RuleID: "github-pat", Description: "GitHub PAT" }];
    const out = normalizeFindings({ markdownlint: [], gitleaks, lychee: [] });
    expect(out[0]).toMatchObject({ category: "secrets", file: "b.md", line: 5, rule: "github-pat", severity: "warning", message: "GitHub PAT" });
  });

  test("maps lychee failures to notice-level link findings", () => {
    const lychee = { fail_map: { "c.md": [{ url: "https://dead.example", status: "404" }] } };
    const out = normalizeFindings({ markdownlint: [], gitleaks: [], lychee });
    expect(out[0]).toMatchObject({ category: "links", file: "c.md", severity: "notice", line: 0, rule: "broken-link", message: expect.stringContaining("dead.example") });
  });

  test("pre-normalized content findings pass through unchanged", () => {
    const content = [{ category: "content", file: "x.md", line: 1, severity: "warning", rule: "body-no-steps", message: "no steps" }];
    const out = normalizeFindings({ markdownlint: [], gitleaks: [], lychee: [], content });
    expect(out).toContainEqual(content[0]);
  });
});

describe("renderAnnotations", () => {
  test("emits a workflow warning command per finding", () => {
    const s = renderAnnotations([{ category: "markdown", file: "a.md", line: 3, severity: "warning", rule: "MD009", message: "Trailing spaces" }]);
    expect(s).toContain("::warning file=a.md,line=3,title=markdown/MD009::Trailing spaces");
  });
});

describe("renderComment", () => {
  test("groups by category with counts and a clean-state message", () => {
    const empty = renderComment([], { sha: "abc123" });
    expect(empty).toContain("No issues found");
    expect(empty).toContain("<!-- tutorial-ci-findings -->");
    const c = renderComment([{ category: "secrets", file: "b.md", line: 5, severity: "warning", rule: "github-pat", message: "GitHub PAT" }], { sha: "abc123" });
    expect(c).toContain("### Secrets (1)");
    expect(c).toContain("b.md:5");
    expect(c).toContain("notify-only, does not block merge");
    expect(c).toContain("abc123");
  });
});
