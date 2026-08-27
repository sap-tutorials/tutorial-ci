import { describe, test, expect } from "vitest";
import {
  normalizeFindings,
  renderAnnotations,
  renderComment,
  hasErrorFinding,
  buildTeamMentions,
} from "../scripts/normalize-findings.js";

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

  test("appends team mentions when supplied (error-severity path)", () => {
    const c = renderComment(
      [{ category: "content", file: "x.md", line: 1, severity: "error", rule: "r", message: "boom" }],
      { sha: "abc123", mentions: ["@sap-tutorials/team-a", "@sap-tutorials/team-b"] },
    );
    expect(c).toContain("@sap-tutorials/team-a @sap-tutorials/team-b");
    expect(c).toContain("error-severity issues were found");
  });

  test("renders NO mention when mentions omitted or empty (warning/notice path)", () => {
    const base = [{ category: "secrets", file: "b.md", line: 5, severity: "warning", rule: "x", message: "y" }];
    expect(renderComment(base, { sha: "s" })).not.toContain("@");
    expect(renderComment(base, { sha: "s", mentions: [] })).not.toContain("@");
  });
});

describe("hasErrorFinding (severity gate)", () => {
  test("true only when at least one finding is error severity", () => {
    expect(hasErrorFinding([{ severity: "error" }])).toBe(true);
    expect(hasErrorFinding([{ severity: "warning" }, { severity: "error" }])).toBe(true);
  });

  test("false for warning/notice-only, empty, or bad input", () => {
    expect(hasErrorFinding([{ severity: "warning" }, { severity: "notice" }])).toBe(false);
    expect(hasErrorFinding([])).toBe(false);
    expect(hasErrorFinding(undefined)).toBe(false);
    expect(hasErrorFinding(null)).toBe(false);
  });
});

describe("buildTeamMentions (zero/one/many + edge cases)", () => {
  const org = "sap-tutorials";

  test("ZERO teams → no mentions", () => {
    expect(buildTeamMentions([], org)).toEqual([]);
  });

  test("ONE team → single @org/slug mention", () => {
    expect(buildTeamMentions([{ slug: "tutorial-editors" }], org)).toEqual(["@sap-tutorials/tutorial-editors"]);
  });

  test("MULTIPLE teams → one mention each", () => {
    expect(buildTeamMentions([{ slug: "a" }, { slug: "b" }], org)).toEqual([
      "@sap-tutorials/a",
      "@sap-tutorials/b",
    ]);
  });

  test("de-duplicates repeated slugs and skips entries without a slug", () => {
    expect(buildTeamMentions([{ slug: "a" }, { slug: "a" }, {}, { slug: "" }, { slug: "b" }], org)).toEqual([
      "@sap-tutorials/a",
      "@sap-tutorials/b",
    ]);
  });

  test("null/non-array input or missing org → [] (never throws)", () => {
    expect(buildTeamMentions(null, org)).toEqual([]);
    expect(buildTeamMentions(undefined, org)).toEqual([]);
    expect(buildTeamMentions([{ slug: "a" }], "")).toEqual([]);
  });
});
