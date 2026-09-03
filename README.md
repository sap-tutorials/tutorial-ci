# tutorial-ci

Central, org-maintained **PR content checks** for SAP tutorial repos in the
`sap-tutorials` org. Replaces the legacy CircleCI `tutorial-checker` orb.

Checks are **notify-only** — they surface issues as inline PR annotations and a
sticky summary comment, and never block a merge — **with one exception**:
**structural errors** that make a tutorial unpublishable (no YAML frontmatter,
or a file that parses to **0 steps**) fail the check so authors fix them at PR
time instead of merging a tutorial the publish pipeline rejects and a full
rebuild silently skips.

## What it checks

- **Markdown lint** (markdownlint-cli2)
- **Spelling** (cspell, notice-only — uses a committed SAP-terminology dictionary in
  `config/sap-dictionary.txt`)
- **Links** (lychee, warn-only)
- **Secrets** (gitleaks, with SAP-specific patterns)
- **SAP content rules** (frontmatter/step/validation contract — added by the
  content-checker in `checker/`)

## Adopting it in a repo

Each content repo installs **two** ~10-line caller workflows (both pinned to the
moving `@v1` tag, so central updates propagate with no per-repo edits):

`.github/workflows/tutorial-pr-checks.yml` (runs the checks on the PR):

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

`.github/workflows/tutorial-pr-comment.yml` (posts the sticky comment; the
`workflow_run` split keeps fork PRs fork-safe):

```yaml
name: Tutorial PR Comment
on:
  workflow_run:
    workflows: ["Tutorial PR Checks"]
    types: [completed]
jobs:
  comment:
    uses: sap-tutorials/tutorial-ci/.github/workflows/post-results.yml@v1
    permissions:
      actions: read
      contents: read
    secrets: inherit
```

New repos inherit both from the tutorial templates; existing repos receive them
via the `rollout.yml` fan-out (auto-detects repos containing a `tutorials/`
directory; tooling/templates excluded).

## Setup prerequisites (one-time, org/host)

These are required for the cross-repo pipeline to work and were each discovered
the hard way during the first pilot — change any and the pipeline silently degrades:

1. **`tutorial-ci` must be PUBLIC.** Consumer repos (public sources, private
   `-Contribution` repos, and fork PRs with no secrets) all check out this repo's
   `config/` + `scripts/` at runtime; only a public repo is readable by all of
   them without a token. (It holds no secrets — only workflow logic + gitleaks
   detection patterns.)
2. **GitHub App `sap-tutorials-builder`** (`TUTORIALS_APP_ID` /
   `TUTORIALS_APP_PRIVATE_KEY`, org secrets, visibility *all*) must have
   **`contents`, `pull_requests`, `issues`, and `workflows` write**. The comment
   poster and `rollout.yml` mint tokens from it.
3. **Org Actions policy** must allow third-party marketplace actions
   (`allowed_actions: all`, or allowlist `actions/*`, `lycheeverse/lychee-action`,
   `DavidAnson/markdownlint-cli2-action`, `marocchino/sticky-pull-request-comment`,
   `gitleaks`).

Nearly everything is **notify-only**: findings are `warning`/`notice` annotations
plus a sticky comment. The **only** blocking findings are the two structural
`error` rules in `checker/rules/structure.js` (`structure-no-frontmatter`,
`structure-zero-steps`); the final gate step (`scripts/gate-blocking.js`) fails
the PR check when either fires, and fails open on any infra error. To make a
failed check actually prevent merge, mark **Tutorial PR Checks** as a required
status check in branch protection — otherwise it shows as a loud red X.

## Layout

- `.github/workflows/tutorial-pr-checks.yml` — reusable check workflow (`workflow_call`)
- `.github/workflows/post-results.yml` — trusted `workflow_run` comment poster (GitHub App token)
- `.github/workflows/rollout.yml` — installs/updates the caller across content repos
- `config/` — shared markdownlint / cspell / gitleaks / lychee configs
- `scripts/` — findings normalizer, blocking gate, repo enumeration
- `checker/` — SAP content checker (composite action)
- `caller-template/` — the two caller files (checks + comment) synced into each repo

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and tutorial-ci contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/sap-tutorials/tutorial-ci).
