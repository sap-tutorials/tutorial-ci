import { describe, test, expect } from "vitest";
import { scanTargets } from "../scripts/scan-dirs.js";

describe("scanTargets", () => {
  test("maps a changed file to its tutorial folder", () => {
    expect(scanTargets(["tutorials/my-tut/my-tut.md"])).toEqual(["tutorials/my-tut"]);
  });

  test("scopes to the touched folder only — never a sibling tutorial (PR #192 regression)", () => {
    // The PR touched only sapui5-...-deepdive; the secret lived in a DIFFERENT
    // tutorial folder. Folder scoping must not emit that sibling.
    const targets = scanTargets([
      "tutorials/sapui5-flexibility-keyuseradaptation-2-deepdive/sapui5-flexibility-keyuseradaptation-2-deepdive.md",
    ]);
    expect(targets).toEqual(["tutorials/sapui5-flexibility-keyuseradaptation-2-deepdive"]);
    expect(targets).not.toContain("tutorials/btp-integration-suite-oauth-integration-flow");
    // Crucially, never the whole repo.
    expect(targets).not.toContain(".");
  });

  test("de-duplicates folders when several files in one tutorial change", () => {
    expect(
      scanTargets([
        "tutorials/t/t.md",
        "tutorials/t/img.png",
        "tutorials/t/code/sample.js",
      ]),
    ).toEqual(["tutorials/t", "tutorials/t/code"]);
  });

  test("emits one target per distinct touched folder, order preserved", () => {
    expect(scanTargets(["tutorials/a/a.md", "tutorials/b/b.md"])).toEqual([
      "tutorials/a",
      "tutorials/b",
    ]);
  });

  test("a root-level file scans the file itself, never the repo root", () => {
    expect(scanTargets(["README.md"])).toEqual(["README.md"]);
  });

  test("ignores blank / whitespace-only / non-string entries", () => {
    expect(scanTargets(["", "  ", "\t", 42, null, "tutorials/x/x.md"])).toEqual([
      "tutorials/x",
    ]);
  });

  test("normalises backslashes and trims trailing whitespace", () => {
    expect(scanTargets(["tutorials\\win\\win.md  "])).toEqual(["tutorials/win"]);
  });

  test("empty input yields no targets (gitleaks skips)", () => {
    expect(scanTargets([])).toEqual([]);
  });
});
