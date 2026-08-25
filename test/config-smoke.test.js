import { execFileSync } from "node:child_process";
import { test, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

const run = (cmd, args) => {
  try {
    return { code: 0, out: execFileSync(cmd, args, { encoding: "utf8", cwd: root }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

// Tool availability checks — tests auto-skip when tools are absent so `npm test`
// stays green in environments without the full toolchain (CI / pilot verify later).
const hasGitleaks = (() => {
  try { execFileSync("gitleaks", ["version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();

const hasMarkdownlintCli2 = (() => {
  try { execFileSync("markdownlint-cli2", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();

// ---------------------------------------------------------------------------
// gitleaks tests
// ---------------------------------------------------------------------------

test.skipIf(!hasGitleaks)("gitleaks flags the planted secret fixture", () => {
  const r = run("gitleaks", [
    "detect",
    "--no-git",
    "--source", "test/fixtures/planted-secret.md",
    "-c", "config/gitleaks.toml",
  ]);
  expect(r.code).not.toBe(0); // exits non-zero when leaks found
});

test.skipIf(!hasGitleaks)("gitleaks passes the clean fixture", () => {
  const r = run("gitleaks", [
    "detect",
    "--no-git",
    "--source", "test/fixtures/clean.md",
    "-c", "config/gitleaks.toml",
  ]);
  expect(r.code).toBe(0);
});

// ---------------------------------------------------------------------------
// markdownlint-cli2 tests
// ---------------------------------------------------------------------------

test.skipIf(!hasMarkdownlintCli2)("markdownlint-cli2 flags the bad-markdown fixture", () => {
  const r = run("markdownlint-cli2", [
    "--config", "config/markdownlint.yaml",
    "test/fixtures/bad-markdown.md",
  ]);
  expect(r.code).not.toBe(0); // exits non-zero when violations found
});

test.skipIf(!hasMarkdownlintCli2)("markdownlint-cli2 passes the clean fixture", () => {
  const r = run("markdownlint-cli2", [
    "--config", "config/markdownlint.yaml",
    "test/fixtures/clean.md",
  ]);
  expect(r.code).toBe(0);
});
