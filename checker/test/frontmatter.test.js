import { test, expect } from "vitest";
import { runChecks } from "../index.js";
import { frontmatterRules } from "../rules/frontmatter.js";
const check = (md) => runChecks(md, "tutorials/x/x.md", frontmatterRules);

test("missing required fields are each reported", () => {
  const md = "---\ntitle: X\n---\n# X\n";
  const rules = check(md).map((f) => f.rule);
  expect(rules).toContain("frontmatter-missing-field"); // time/author_name/author_profile/tags/primary_tag absent
  const msgs = check(md).map((f) => f.message).join(" ");
  expect(msgs).toMatch(/author_name/);
  expect(msgs).toMatch(/primary_tag/);
});

test("string time that has no digits is flagged", () => {
  const md = "---\ntime: soon\nauthor_name: A\nauthor_profile: https://github.com/a\ntags: [x]\nprimary_tag: t\n---\n# X\n";
  expect(check(md).map((f) => f.rule)).toContain("frontmatter-time-not-numeric");
});

test("numeric-coercible string time does NOT flag", () => {
  const md = "---\ntime: 30 mins\nauthor_name: A\nauthor_profile: https://github.com/a\ntags: [x]\nprimary_tag: t\n---\n# X\n";
  expect(check(md).map((f) => f.rule)).not.toContain("frontmatter-time-not-numeric");
});

test("merge conflict markers are surfaced", () => {
  const md = "---\ntitle: X\n---\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> other\n";
  expect(check(md).map((f) => f.rule)).toContain("frontmatter-merge-marker");
});

test("unquoted yes/no value coerces to boolean under YAML 1.1", () => {
  const md = "---\nprimary_tag: no\ntime: 5\nauthor_name: A\nauthor_profile: https://github.com/a\ntags: [x]\n---\n# X\n";
  expect(check(md).map((f) => f.rule)).toContain("frontmatter-yaml11-boolean");
});

test("missing tutorial>level tag warns", () => {
  const md = "---\ntime: 5\nauthor_name: A\nauthor_profile: https://github.com/a\ntags: [software-product>x]\nprimary_tag: t\n---\n# X\n";
  expect(check(md).map((f) => f.rule)).toContain("frontmatter-missing-level-tag");
});
