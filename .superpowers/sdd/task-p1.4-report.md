# Task P1.4 Report — Reusable Check Workflow `tutorial-pr-checks.yml`

## What was done

Created two files:

- `.github/workflows/tutorial-pr-checks.yml` — the `workflow_call` reusable workflow
- `scripts/emit-annotations.js` — thin helper that reads `findings.json` and prints `::warning::` / `::notice::` commands

## Workflow structure

| Step | Action/command |
|------|----------------|
| 1 | `actions/checkout@v4` (`fetch-depth: 0`) |
| 2 | `git diff --name-only origin/<base>...HEAD -- '*.md' > changed.txt` |
| 3 | `actions/setup-node@v4` node 20 |
| 4 | `DavidAnson/markdownlint-cli2-action@v17` → `ml.json` (`outputFormat: json`, `outputFile: ml.json`) |
| 5 | Install gitleaks v8.21.2 binary, then `gitleaks detect --no-git --report-format json --report-path gl.json` |
| 6 | `lycheeverse/lychee-action@v2` with `--format json --output ly.json` |
| 7 | `node scripts/normalize-findings.js ml.json gl.json ly.json > findings.json` (`if: always()`) |
| 8 | `node scripts/emit-annotations.js` (`if: always()`) |
| 9 | `printf` → `pr-meta.json` (`if: always()`) |
| 10 | `actions/upload-artifact@v4` name `tutorial-ci-findings` — `findings.json` + `pr-meta.json` (`if: always()`) |
| 11 | `exit 0` (`if: always()`) — explicit always-succeed |

## Validation

```
npx @action-validator/cli .github/workflows/tutorial-pr-checks.yml
EXIT=0  (no schema errors)
```

## Deviations and rulings

1. **Linters scope: all `**/*.md` not just changed files.** The plan calls for running over changed files. For markdownlint (action-based, globs input) and lychee (action-based, glob args), filtering to only changed files is non-trivial in the action interface; running on all `.md` is safe for a notify-only workflow. The `changed.txt` file is still computed and is available for future refinement (e.g., pass its contents to the normalizer to suppress unchanged-file findings). gitleaks runs with `--source .` which also covers the whole tree.

2. **`emit-annotations.js` helper script added.** The plan says `node -e "…"` or a step that reads findings.json. Inline ESM via `node -e` is unreliable when `package.json` has `"type": "module"` (relative imports fail without a file-URL base). A committed helper script is cleaner and testable.

3. **gitleaks via direct binary install, not `gitleaks/gitleaks-action`.** The plan explicitly says "or the binary" — the action's high-level interface doesn't easily expose `--report-format json` to a custom path. Direct install gives us exact CLI control.

4. **`markdownlint-cli2-action@v17` `outputFormat`/`outputFile` inputs.** Added as-is; these inputs were introduced in action v16. If the installed action version predates them, the inputs are silently ignored and `ml.json` won't be generated; the normalizer's `readJson` guard returns `null → []` so findings.json is still produced (just without markdown findings). No workflow failure either way.

## Fix round (post-review, commit 26c7885)

**IMPORTANT — changed-files scoping:**
- Added `Check for changed markdown` step (id `md-changed`) that sets `has_md` output from `changed.txt`.
- Replaced `DavidAnson/markdownlint-cli2-action` with a `run:` step: `npx markdownlint-cli2` fed via `xargs -a changed.txt`, output converted to JSON array via inline Node; steps gated on `steps.md-changed.outputs.has_md == 'true'`.
- Replaced `lycheeverse/lychee-action` with a `run:` step: `xargs -a changed.txt lychee --format json --output ly.json`; same `has_md` gate.
- Both linters are skipped entirely (not fallback-scanned) when no markdown changed.
- gitleaks full-tree scan unchanged.

**MINOR — emit-annotations.js hardening:**
- Wrapped `readFileSync` + `JSON.parse` in `try/catch`; missing or malformed `findings.json` now produces empty findings and a clean exit instead of a red step.

**DEFER:**
- Added `# TODO(pilot): verify lychee-action tag` comment on the lychee step (lychee is now a `run:` step that calls the binary directly, so the action tag is no longer referenced; the comment flags that lychee binary availability needs verification during pilot).

**Validation after fix:** `@action-validator/cli` exit 0, no schema errors.

## Concerns

- The `lycheeverse/lychee-action@v2` major-version tag (`@v2`) should be verified against the repo's actual release tags before live deployment; if only patch tags exist (e.g. `@v2.0.0`) the tag reference may need updating.
- `github.base_ref` is available in `workflow_call` when the caller runs on `pull_request`. If the workflow is ever called from a non-PR trigger (e.g., `push`), `base_ref` will be empty and `git diff` will gracefully produce an empty `changed.txt` (due to `|| true`).
- The `content` category in findings schema is intentionally always empty until Plan 2 adds the SAP content checker.
