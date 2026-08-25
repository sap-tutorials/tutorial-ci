import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vitest";

test("cli prints content findings JSON for the given files and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "chk-"));
  const f = join(dir, "x.md");
  writeFileSync(f, "---\ntitle: X\n---\nno steps here\n");
  const out = execFileSync("node", ["checker/cli.js", f], { encoding: "utf8" });
  const findings = JSON.parse(out);
  expect(Array.isArray(findings)).toBe(true);
  expect(findings.every((x) => x.category === "content")).toBe(true);
  expect(findings.some((x) => x.rule === "frontmatter-missing-field")).toBe(true);
});
