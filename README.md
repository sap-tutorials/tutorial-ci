# tutorial-ci

Central, org-maintained **PR content checks** for SAP tutorial repos in the
`sap-tutorials` org. Replaces the legacy CircleCI `tutorial-checker` orb.

Checks are **notify-only** — they surface issues as inline PR annotations and a
sticky summary comment, and never block a merge.

## What it checks

- **Markdown lint** (markdownlint-cli2)
- **Links** (lychee, warn-only)
- **Secrets** (gitleaks, with SAP-specific patterns)
- **SAP content rules** (frontmatter/step/validation contract — added by the
  content-checker in `checker/`)

## Adopting it in a repo

Add this ~10-line caller as `.github/workflows/tutorial-pr-checks.yml`:

```yaml
name: Tutorial PR Checks
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  checks:
    uses: sap-tutorials/tutorial-ci/.github/workflows/tutorial-pr-checks.yml@v1
    permissions:
      contents: read
    secrets: inherit
```

Pinned to the moving `@v1` tag — central updates propagate automatically with no
per-repo edits. New repos inherit it from the tutorial templates; existing repos
receive it via the `rollout.yml` fan-out.

## Layout

- `.github/workflows/tutorial-pr-checks.yml` — reusable check workflow (`workflow_call`)
- `.github/workflows/post-results.yml` — trusted `workflow_run` comment poster (GitHub App token)
- `.github/workflows/rollout.yml` — installs/updates the caller across content repos
- `config/` — shared markdownlint / gitleaks / lychee configs
- `scripts/` — findings normalizer, repo enumeration
- `checker/` — SAP content checker (composite action)
- `caller-template/` — the caller file synced into each repo
