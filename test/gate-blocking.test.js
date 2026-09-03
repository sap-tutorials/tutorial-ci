import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";

const gate = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "scripts", "gate-blocking.js");

function run(findings) {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const f = join(dir, "findings.json");
  writeFileSync(f, JSON.stringify(findings));
  try {
    const out = execFileSync("node", [gate, f], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

test("exits 1 when a finding is error severity (blocking)", () => {
  const r = run([{ category: "content", file: "t/x.md", line: 1, severity: "error", rule: "structure-zero-steps", message: "0 steps" }]);
  expect(r.code).toBe(1);
  expect(r.out).toContain("structure-zero-steps");
});

test("exits 0 for warning/notice-only findings (notify-only preserved)", () => {
  const r = run([
    { category: "markdown", file: "a.md", line: 3, severity: "warning", rule: "MD009", message: "trailing spaces" },
    { category: "spelling", file: "a.md", line: 4, severity: "notice", rule: "unknown-word", message: "typo" },
  ]);
  expect(r.code).toBe(0);
});

test("exits 0 (fail-open) when findings.json is missing", () => {
  const missing = join(mkdtempSync(join(tmpdir(), "gate-")), "nope.json");
  try {
    execFileSync("node", [gate, missing], { encoding: "utf8" });
    expect(true).toBe(true);
  } catch (e) {
    expect(e.status).toBe(0);
  }
});
