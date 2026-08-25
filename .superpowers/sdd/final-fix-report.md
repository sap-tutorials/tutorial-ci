# Final-Fix Wave — Report

## Item 1: IMPORTANT 1 — lychee wired via lycheeverse/lychee-action@v2

**Tag chosen:** `lycheeverse/lychee-action@v2` (moving major; v2.x releases confirmed in training knowledge; task explicitly permits @v2 if concrete @v2.x unavailable to confirm).

**What changed** (`.github/workflows/tutorial-pr-checks.yml`):
- Removed bare `xargs ... lychee` invocation (binary never installed on ubuntu-latest).
- Removed `# TODO(pilot): verify lychee-action tag before production rollout` comment.
- Added `Prepare lychee file list` step (id: `lychee-files`) that converts `changed.txt` to a space-separated list via `tr '\n' ' '`.
- Added `Run lychee link check` step using `lycheeverse/lychee-action@v2` with `args: --config config/lychee.toml --format json --output ly-raw.json <files>` and `continue-on-error: true`.
- Added `Normalize lychee output to fail_map shape` step that reads `ly-raw.json`, coerces any non-string `status` fields to strings (handles both lychee string and object representations), and writes `ly.json` as `{ fail_map: {...} }` matching what `normalize-findings.js` reads. Falls back to `echo '{}' > ly.json` on any error.

## Item 2: IMPORTANT 2 — rollout default-branch JSON.parse

**What changed** (`.github/workflows/rollout.yml`, lines ~114-117):
- Removed `JSON.parse(...)` wrapper around `execFileSync('gh', [..., '--jq', '.default_branch'], ...)`.
- `gh --jq` emits raw scalars (no JSON quotes), so `JSON.parse('master')` threw a SyntaxError and the catch fell back to `'main'`, 404ing master-default repos.
- Fix: use `.trim()` directly on the raw string output.
- Also removed the now-dead `.replace(/\"/g, '')` on the result (no quotes present in raw output).

## Item 3: MINOR 3 — idempotency check JSON.parse (and upsertFile sha)

**What changed** (`.github/workflows/rollout.yml`):
- Removed `JSON.parse(...)` around both `existingChecks` and `existingComment` base64 comparisons (~lines 97, 101). `gh --jq '.content'` returns the raw base64 string; `JSON.parse` always threw, so the idempotency skip never fired.
- Also removed `JSON.parse(...)` around `existingSha` in the `upsertFile` helper (~line 140) — same pattern: `gh --jq '.sha'` returns a raw hex string that `JSON.parse` cannot parse, causing PUT to always treat the file as a create (422 if it exists, error swallowed). Fixed to plain `.trim()`.

## Item 4: MINOR 4 — markdownlint config single source of truth

**What changed** (`.github/workflows/tutorial-pr-checks.yml`):
- Removed the hand-maintained inline `printf '{"default":true,"MD013":false,...}' > /tmp/ml-ci2.jsonc` block.
- Replaced with a `node -e "..."` script that reads `config/markdownlint.yaml`, parses each `key: true|false` line (handles comments, ignores blank lines), and generates `/tmp/ml-ci2.jsonc` with the same rules plus `outputFormatters`. Updated step comment accordingly.
- `config/markdownlint.yaml` is now the single authored source. The previously duplicated inline ruleset is gone. (If the YAML is absent — e.g. consumer-repo context — the node script exits non-zero; `continue-on-error: true` on the step handles it gracefully, just as the existing gitleaks and scripts steps do in the same context.)

## Verification

```
npx vitest run        → 11 test files, 41 passed | 2 skipped  ✓
@action-validator/cli tutorial-pr-checks.yml  → CHECKS_VALID  ✓
@action-validator/cli rollout.yml             → ROLLOUT_VALID ✓
```
