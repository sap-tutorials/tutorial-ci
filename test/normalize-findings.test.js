import { describe, test, expect } from "vitest";
import {
  normalizeFindings,
  renderAnnotations,
  renderComment,
  hasErrorFinding,
  buildTeamMentions,
  matchesAllowlist,
} from "../scripts/normalize-findings.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

  test("maps cspell shaped issues to notice-level spelling findings", () => {
    const cspell = [{ file: "d.md", line: 9, word: "resposne", suggestions: ["response"] }];
    const out = normalizeFindings({ markdownlint: [], gitleaks: [], lychee: [], cspell });
    expect(out[0]).toMatchObject({
      category: "spelling",
      file: "d.md",
      line: 9,
      severity: "notice",
      rule: "unknown-word",
      message: expect.stringContaining("resposne"),
    });
    expect(out[0].message).toContain("response");
  });

  test("cspell findings never carry a blocking severity (notify-only)", () => {
    const cspell = [{ file: "e.md", line: 1, word: "wrng" }];
    const out = normalizeFindings({ markdownlint: [], gitleaks: [], lychee: [], cspell });
    // renderAnnotations only ever emits notice/warning — a spelling finding must be notice.
    expect(out.every((f) => f.category !== "spelling" || f.severity === "notice")).toBe(true);
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

describe("buildTeamMentions (allowlist filtering + zero/one/many + edge cases)", () => {
  const org = "sap-tutorials";
  // Broad allowlist used by the basic zero/one/many cases below.
  const ANY = ["*"];

  test("ZERO teams → no mentions", () => {
    expect(buildTeamMentions([], org, ANY)).toEqual([]);
  });

  test("ONE allowlisted team → single @org/slug mention", () => {
    expect(buildTeamMentions([{ slug: "authors" }], org, ["authors"])).toEqual(["@sap-tutorials/authors"]);
  });

  test("MULTIPLE allowlisted teams → one mention each", () => {
    expect(buildTeamMentions([{ slug: "authors" }, { slug: "publishers" }], org, ["authors", "publishers"])).toEqual([
      "@sap-tutorials/authors",
      "@sap-tutorials/publishers",
    ]);
  });

  test("de-duplicates repeated slugs and skips entries without a slug", () => {
    expect(buildTeamMentions([{ slug: "a" }, { slug: "a" }, {}, { slug: "" }, { slug: "b" }], org, ANY)).toEqual([
      "@sap-tutorials/a",
      "@sap-tutorials/b",
    ]);
  });

  test("null/non-array input or missing org → [] (never throws)", () => {
    expect(buildTeamMentions(null, org, ANY)).toEqual([]);
    expect(buildTeamMentions(undefined, org, ANY)).toEqual([]);
    expect(buildTeamMentions([{ slug: "a" }], "", ANY)).toEqual([]);
  });

  // ── allowlist filtering with the REAL sap-tutorials/Tutorials team set ──────
  const TUTORIALS_TEAMS = [
    { slug: "authors" },
    { slug: "admins" },
    { slug: "publishers" },
    { slug: "securityalerts" },
    { slug: "monitor" },
    { slug: "devrelations-production" },
    { slug: "admin-write" },
  ];

  test("filters the real Tutorials team set to content owners only", () => {
    const allowlist = ["authors", "publishers", "devrelations-contribution", "devrelations-production"];
    const out = buildTeamMentions(TUTORIALS_TEAMS, org, allowlist);
    // Survivors: authors, publishers, devrelations-production.
    expect(out).toEqual([
      "@sap-tutorials/authors",
      "@sap-tutorials/publishers",
      "@sap-tutorials/devrelations-production",
    ]);
    // Wrong-audience teams are dropped.
    expect(out).not.toContain("@sap-tutorials/securityalerts");
    expect(out).not.toContain("@sap-tutorials/monitor");
    expect(out).not.toContain("@sap-tutorials/admins");
    expect(out).not.toContain("@sap-tutorials/admin-write");
  });

  test("glob `devrelations-*` matches BOTH contribution and production teams", () => {
    const teams = [{ slug: "devrelations-backend" }, { slug: "devrelations-contribution" }, { slug: "devrelations-production" }];
    const out = buildTeamMentions(teams, org, ["devrelations-*"]);
    expect(out).toEqual([
      "@sap-tutorials/devrelations-backend",
      "@sap-tutorials/devrelations-contribution",
      "@sap-tutorials/devrelations-production",
    ]);
  });

  test("EMPTY or MISSING allowlist → mention NONE (fail-safe)", () => {
    expect(buildTeamMentions(TUTORIALS_TEAMS, org, [])).toEqual([]);
    expect(buildTeamMentions(TUTORIALS_TEAMS, org)).toEqual([]); // allowlist omitted
    expect(buildTeamMentions(TUTORIALS_TEAMS, org, null)).toEqual([]);
    expect(buildTeamMentions(TUTORIALS_TEAMS, org, "authors")).toEqual([]); // non-array
  });

  test("a slug matching NO pattern is dropped (literal, no accidental substring)", () => {
    // "author" pattern must NOT match "authors" (full-string anchored).
    expect(buildTeamMentions([{ slug: "authors" }], org, ["author"])).toEqual([]);
  });
});

describe("matchesAllowlist (tiny glob matcher)", () => {
  test("exact literal match", () => {
    expect(matchesAllowlist("authors", ["authors"])).toBe(true);
    expect(matchesAllowlist("authors", ["publishers"])).toBe(false);
  });

  test("`*` wildcard matches any run of characters", () => {
    expect(matchesAllowlist("devrelations-contribution", ["devrelations-*"])).toBe(true);
    expect(matchesAllowlist("devrelations-production", ["devrelations-*"])).toBe(true);
    expect(matchesAllowlist("securityalerts", ["devrelations-*"])).toBe(false);
    expect(matchesAllowlist("anything", ["*"])).toBe(true);
  });

  test("anchored full-string (no accidental substring/regex-meta match)", () => {
    expect(matchesAllowlist("authors", ["author"])).toBe(false); // not a prefix match
    expect(matchesAllowlist("a.b", ["a.b"])).toBe(true); // `.` is literal, not regex any-char
    expect(matchesAllowlist("aXb", ["a.b"])).toBe(false); // `.` must NOT match X
  });

  test("empty/missing allowlist or slug → false (never throws)", () => {
    expect(matchesAllowlist("authors", [])).toBe(false);
    expect(matchesAllowlist("authors", null)).toBe(false);
    expect(matchesAllowlist("", ["*"])).toBe(false);
  });
});

describe("config/notify-teams.json (committed allowlist)", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const cfgPath = path.resolve(__dirname, "..", "config", "notify-teams.json");

  test("is valid JSON with a string[] teamSlugAllowlist", () => {
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    expect(Array.isArray(cfg.teamSlugAllowlist)).toBe(true);
    expect(cfg.teamSlugAllowlist.every((s) => typeof s === "string")).toBe(true);
  });

  test("default allowlist filters the real Tutorials set to authors+publishers+devrelations-production", () => {
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    const tutorialsTeams = [
      { slug: "authors" }, { slug: "admins" }, { slug: "publishers" }, { slug: "securityalerts" },
      { slug: "monitor" }, { slug: "devrelations-production" }, { slug: "admin-write" },
    ];
    expect(buildTeamMentions(tutorialsTeams, "sap-tutorials", cfg.teamSlugAllowlist)).toEqual([
      "@sap-tutorials/authors",
      "@sap-tutorials/publishers",
      "@sap-tutorials/devrelations-production",
    ]);
  });
});
