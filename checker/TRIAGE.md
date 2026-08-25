# Legacy Tutorial-Checker Rule Triage

**Source repo:** `sap-tutorials/tutorial-checker` (`test-tool/src/checkers/` + `analyze/`)
**Contract source of truth:** plan §"Current contract" block (parsers: `scripts/parsers/{frontmatter,rules,options,types,os-classifier}.ts` in `tutorials-ims`)
**Decision guidance:** link/spell → DROP (Plan 1 lychee/markdownlint); metadata/tags → UPDATE to current required-field set; validations/syntax → UPDATE to `[VALIDATE_N]`/`###` contract; ACCORDION-era → DROP (parser does not honor `ACCORDION-BEGIN`/`ACCORDION-END`).

---

## Decision Table

| legacy check | still relevant? | decision | new rule id | notes |
|---|---|---|---|---|
| **SPELL CHECKER** | | | | |
| `spell-checker`: word spelling errors in body text | No | DROP | — | Covered by Plan 1 off-the-shelf spell tooling (cspell/aspell via markdownlint or standalone). No network/dict needed here. |
| **LINK CHECKER** | | | | |
| `link-checker`: HTTP reachability of external URLs | No | DROP | — | Covered by Plan 1 lychee. This checker is structure/contract only — no network. |
| `link-checker`: remote image content-type check | No | DROP | — | Covered by Plan 1 lychee. |
| `metadata-checker`: author_profile URL HTTP validity | No | DROP | — | Covered by Plan 1 lychee. Presence of the field is a separate NEW rule below. |
| **CONTENT CHECKER — typography/style** | | | | |
| `content-checker`: empty alt-text `[](...)` | No | DROP | — | Covered by markdownlint (MD045, MD042). |
| `content-checker`: short alt-text for images (< 3 chars) | No | DROP | — | Covered by markdownlint. |
| `content-checker`: curly/smart quotes detection | No | DROP | — | Covered by markdownlint or typography rules in Plan 1. |
| `content-checker`: suspicious file type in link (.exe) | No | DROP | — | Not in current parser contract; markdownlint-adjacent. |
| `content-checker`: plain-text bare URL (not in markdown syntax) | No | DROP | — | Covered by markdownlint MD034. |
| `content-checker`: empty URL field `[text]()` | No | DROP | — | Covered by markdownlint MD042. |
| **CONTENT CHECKER — structural (AEM v1)** | | | | |
| `content-checker`: H1 heading (`# `) not allowed | No | DROP | — | This was an AEM v1 rule where H1 was banned. **Current contract requires H1 for the tutorial title** (or `title:` in frontmatter). Inverting this rule would be incorrect; body-missing-title (NEW) covers the absence case. |
| `content-checker`: local image existence on disk | No | DROP | — | Requires filesystem access; images are now stored in S3/HANA object store, not alongside the markdown. |
| `content-checker`: local image size > 1 MB | No | DROP | — | Same filesystem dependency; irrelevant to PR content check. |
| `content-checker`: image alt-text equals filename | No | DROP | — | Covered by markdownlint MD045 + style guidance; not a parser contract item. |
| `content-checker`: tutorial cross-reference link exists | No | DROP | — | Requires network or full tutorial index; covered by Plan 1 lychee. |
| `content-checker`: tutorial link with `.html` suffix | No | DROP | — | Covered by Plan 1 lychee URL checks. |
| `content-checker`: local file link (should be GitHub raw URL) | No | DROP | — | Covered by Plan 1 lychee. |
| **CONTENT CHECKER — structural (AEM v2 / parserV2)** | | | | |
| `content-checker` (v2): `## You will learn` must be exactly H2 | Partially | UPDATE | `body-missing-you-will-learn` | Current contract still requires `## You will learn` as an H2 bullet list. Rule is rewritten for the `[VALIDATE_N]`/`###` pipeline (not accordion-based). |
| `content-checker` (v2): `## Details` section banned | No | DROP | — | AEM parserV2 specific; not a current parser contract constraint. |
| `content-checker` (v2): `## Intro` must follow You will learn | No | DROP | — | AEM parserV2 specific; not in current contract. |
| `content-checker` (v2): border image syntax (`<!--border-->![`) | No | DROP | — | AEM parserV2 image modifier syntax; not used by current Hugo/CAP pipeline. |
| `content-checker` (v2): download file extension check | No | DROP | — | AEM parserV2 specific; not in current contract. |
| **METADATA CHECKER** | | | | |
| `metadata-checker`: `title:` required in frontmatter | Partially | UPDATE | `body-missing-title` | Current contract: `title:` is optional if `# Title` H1 is present in body. Rule becomes: no H1 AND no `title:` → warn. Field set changed. |
| `metadata-checker`: `description:` required in frontmatter | No | DROP | — | Current contract: `description:` is optional (body uses `<!-- description -->` comment block, or frontmatter). Not required; absence doesn't break the pipeline. |
| `metadata-checker`: `tags:` required (non-empty, category>value format) | Yes | UPDATE | `frontmatter-missing-field` | Required field unchanged. Implementation rewritten: checks `ctx.frontmatter.tags` array via gray-matter; field name is `tags`. Absence → `frontmatter-missing-field` naming the field. |
| `metadata-checker`: `primary_tag:` required (category>value format) | Yes | UPDATE | `frontmatter-missing-field` | Required field unchanged. Implementation rewritten: checks `ctx.frontmatter.primary_tag`. Absence → `frontmatter-missing-field`. |
| **TAGS CHECKER** | | | | |
| `tags-checker`: `primary_tag` must have exactly one value | No | DROP | — | Current parser silently uses first value if multiple are supplied; not a contract-breaking defect. Mirror-the-parser rule: drop. |
| `tags-checker`: `tags` must contain `tutorial>beginner\|intermediate\|advanced` | Yes | UPDATE | `frontmatter-missing-level-tag` | Still required. Level is derived from this tag; absence silently defaults to beginner (author likely forgot). Severity: `notice`. |
| **VALIDATIONS CHECKER — v1 (ACCORDION-BEGIN/ACCORDION-END)** | | | | |
| `validations-checker` (v1): `auto_validation:` property required | No | DROP | — | `auto_validation` was an AEM-era meta flag; current pipeline uses `[VALIDATE_N]` blocks anywhere in the body, no gating property. |
| `validations-checker` (v1): `rules.vr` file present (non-prod) | No | DROP | — | `rules.vr` is an AEM-era companion file; current pipeline uses inline `###Rule`/`###Question`/`###Match`/`###Grading` sections within `[VALIDATE_N]` blocks. |
| `validations-checker` (v1): `rules.vr` must NOT be in production | No | DROP | — | Same — `rules.vr` file concept is entirely gone. |
| `validations-checker` (v1): every accordion has `[VALIDATE_N]` or `[DONE]` | No | DROP | — | ACCORDION-BEGIN/ACCORDION-END syntax is not honored by the current parser; steps are `## Heading` sections. |
| `validations-checker` (v1): no duplicate `VALIDATE_N` numbers | Partially | DROP | — | Still logically relevant, but the current contract spec does not define a named rule for this (plan's rule-id list has no `validate-duplicate-number`). Mirror-the-parser: the parser processes each `[VALIDATE_N]` independently. Drop; could be added in a later pass if it proves a real issue. |
| `validations-checker` (v1): `VALIDATE_N` must be defined in rules.vr | No | DROP | — | rules.vr gone; inline `###Rule`/`###Question`/`###Match` define the block. |
| **VALIDATIONS CHECKER — v2 (ACCORDION-based)** | | | | |
| `validations-checker` (v2): no `[DONE]` tag inside v2 steps | No | DROP | — | `[DONE]` was an AEM-era completion button; not in current contract. |
| `validations-checker` (v2): `[VALIDATE_*]` tags not inside v2 accordions | No | DROP | — | ACCORDION-era constraint; current parser uses `[VALIDATE_N]` at the top level of a step body. |
| **ANALYZE — VALIDATE/DONE accordion (analyze/validation/validator.js)** | | | | |
| `analyze/validator`: ACCORDION-BEGIN/ACCORDION-END based VALIDATE/DONE analysis | No | DROP | — | `analyze/` tooling uses the old `ACCORDION-BEGIN`/`ACCORDION-END` regex. The current parser does NOT honor these tokens; steps are H2 headings. Entire accordion-based analysis is irrelevant. |
| **OPTIONS CHECKER** | | | | |
| `options-checker`: `[OPTION BEGIN [TabName]]` / `[OPTION END]` count balanced | Yes | UPDATE | `option-unbalanced` | Still required. Current contract: every `[OPTION BEGIN [TabName]]` needs a matching `[OPTION END]`. Implementation rewritten to scan `ctx.lines` directly (not accordion-scoped). |
| `options-checker`: no content between option blocks | No | DROP | — | Parser silently ignores inter-block content; not a breaking defect per "mirror the parser" rule. |
| `options-checker`: at least 2 options per group | No | DROP | — | Parser renders a single-option block; not a pipeline-breaking defect per current contract. |
| `options-checker`: duplicate tab names within a group | No | DROP | — | Parser renders both tabs; user sees duplicate names but content is not lost. Not in current contract as a breaking defect. Mirror-the-parser → drop. |
| `options-checker`: `[OPTION BEGIN [TabName]]` has a non-empty tab name | Yes | UPDATE | `option-missing-tabname` | Legacy `regexps.full` requires `.+` inside `[...]`, so empty `[]` didn't match and was silently unchecked. Current contract: `[OPTION BEGIN []]` emits a tab with no label. Rule added explicitly. |
| **SYNTAX CHECKER** | | | | |
| `syntax-checker`: bracket/paren balance `{}[]()` per non-code line | No | DROP | — | Produces false positives on valid markdown (e.g. image syntax, link syntax with multiple brackets). Not in current parser contract. Markdownlint handles structural markdown syntax. |
| `syntax-checker`: `[DONE]` must not be indented | No | DROP | — | `[DONE]` is an AEM-era completion button; not in current contract. |
| `syntax-checker`: blank line required before `[DONE]`/`[VALIDATE]` | No | DROP | — | AEM-era ACCORDION indentation rule; not in current contract. |
| `syntax-checker`: ` ``` ` must be on its own line | No | DROP | — | Covered by markdownlint MD031/MD040. |
| **FILE-NAME CHECKER** | | | | |
| `file-name-checker`: slug must not end with `-` | No | DROP | — | Edge case not in current parser contract; slug normalization happens at fetch time. |
| `file-name-checker`: no uppercase letters, underscores, or umlauts in slug | Yes | UPDATE | `path-uppercase-slug` | Still directly relevant. A mixed-case slug causes 404s and mis-routing (Hugo emits lowercase; read path 301-redirects). Rewritten to operate on `ctx.filename` path segments. |
| `file-name-checker`: slug max length (60 chars) | No | DROP | — | Not in current contract; not a pipeline-breaking defect. |
| `file-name-checker`: slug max keyword chunks (10 dash-separated words) | No | DROP | — | Not in current contract. |
| `file-name-checker`: no common English stop words in slug | No | DROP | — | Not in current contract; editorial guidance only. |
| `file-name-checker`: folder name must match file name | Partially | UPDATE | `path-wrong-location` | Partially maps to the "tutorial markdown lives at `tutorials/<slug>/<slug>.md`" contract. Rewritten as `path-wrong-location`: if a `.md` file is not under `tutorials/<slug>/`, it will 404 or mis-route. |
| `file-name-checker`: no sub-folders inside `tutorials/<slug>/` | No | DROP | — | Not in current contract as a breaking defect; parsers ignore nested files. |

---

## NEW Rows (no legacy equivalent)

These rules implement contract items that the legacy tool never checked.

| new rule | new rule id | severity | rationale |
|---|---|---|---|
| `time` field required in frontmatter | `frontmatter-missing-field` (field: time) | `warning` | `time` (number) is required. Pipeline coerces strings but absence means card shows no estimated time. |
| `author_name` field required in frontmatter | `frontmatter-missing-field` (field: author_name) | `warning` | Required per current parser contract; legacy checker had no `author_name` check. |
| `author_profile` field required in frontmatter | `frontmatter-missing-field` (field: author_profile) | `warning` | Required per current parser contract; legacy only checked URL validity via HTTP (now lychee), not presence. |
| `time` is a string without extractable digits → pipeline silently drops time value | `frontmatter-time-not-numeric` | `warning` | Pipeline coerces `"30 mins"` → `30` (OK) but drops `"soon"` silently (card shows no time). Warn so authors fix the source. |
| Git merge conflict markers (`<<<<<<<`/`=======`/`>>>>>>>`) in file | `frontmatter-merge-marker` | `warning` | Sanitizer strips these, but the source tutorial is then malformed. Surface so authors resolve before merge. |
| YAML 1.1 boolean coercion: `yes/no/on/off` in string-typed frontmatter fields | `frontmatter-yaml11-boolean` | `warning` | Hugo reads frontmatter as YAML 1.1. Bare `yes/no/on/off` coerce to booleans silently (e.g. `primary_tag: no` → `false`). Warn per the `hugo-frontmatter-yaml-11` gotcha. |
| `tags` array is empty (present but no entries) | `frontmatter-empty-tags` | `notice` | Distinct from missing `tags` field. An empty array passes the presence check but provides no routing/categorisation metadata. |
| Body has no `# Title` H1 and no `title:` in frontmatter | `body-missing-title` | `warning` | Current contract: title can be H1 in body or `title:` in frontmatter; absence of both → tutorial renders with no visible title. |
| Body has no `## You will learn` section | `body-missing-you-will-learn` | `notice` | Parser expects this section; absence means the "What you'll learn" block on the tutorial card is empty. |
| Body has no `## Prerequisites` section | `body-missing-prerequisites` | `notice` | Parser expects this section; absence means prerequisites block is omitted from the rendered page. |
| Body has no `## ` step headings | `body-no-steps` | `warning` | Steps are derived from H2 headings (excluding You will learn / Prerequisites). Zero steps → tutorial renders as a blank step list. |
| `[VALIDATE_N]` block has no `###Question` → silently dropped by parser | `validate-missing-question` | `warning` | Parser requires `###Question` to emit a validation block. Missing → block silently omitted; author thinks it's there. |
| Text-type `[VALIDATE_N]` block has no `###Match` content | `validate-missing-answer` | `warning` | Parser drops text-match blocks with no `###Match`. |
| MCQ `[VALIDATE_N]` block has zero `[x]`/`[X]` correct-answer options | `validate-mcq-no-correct` | `warning` | `single-choice` needs exactly one `[x]`; `multiple-choice` needs ≥1. Zero correct options produces an unsolvable question. |
| MCQ `[VALIDATE_N]` block has `###Grading: ai-judged` | `validate-mcq-ai-judged-footgun` | `warning` | Runtime rejects MCQ + ai-judged with `wrong_question_type`. Author intent is ambiguous; the combination parses but always fails at runtime. |
| `###Rule` value is not one of the known types (`single-choice`, `multiple-choice`, `regex`, `regex-begins-with`) | `validate-unknown-rule-type` | `notice` | An unrecognised rule type means the parser falls back to text-match or silently drops the block. |
| `[AUTOAUTHOR_N:suffix]` or `[AUTOAUTHOR_ALL:suffix]` has an unrecognised suffix | `autoauthor-unknown-suffix` | `notice` | Recognised suffixes: `mcq`, `text`. An unknown suffix (e.g. `:essay`) is silently ignored by the parser; author likely has a typo. |
| Markdown file not under `tutorials/<slug>/` path | `path-wrong-location` | `notice` | Tutorial markdown in the repo root or a non-`tutorials/` path will 404 post-publish (per the "New tutorial 404s = wrong repo folder" gotcha in MEMORY.md). |
| `[OPTION BEGIN []]` or `[OPTION BEGIN ]` — empty tab name | `option-missing-tabname` | `warning` | Legacy options-checker's `regexps.full` required `.+` so empty `[]` wasn't detected. Parser emits a tab with a blank label; visible UI defect. |

---

## Summary counts

| decision | count |
|---|---|
| DROP | 36 |
| UPDATE | 8 |
| NEW | 18 |
| **Total** | **62** |

### UPDATE rows (legacy concept → new rule id)
| legacy check | new rule id |
|---|---|
| `metadata-checker`: `tags:` required | `frontmatter-missing-field` |
| `metadata-checker`: `primary_tag:` required | `frontmatter-missing-field` |
| `metadata-checker`: `title:` required → now H1-or-frontmatter | `body-missing-title` |
| `tags-checker`: experience tag (`tutorial>beginner\|intermediate\|advanced`) | `frontmatter-missing-level-tag` |
| `content-checker` (v2): `## You will learn` must be H2 | `body-missing-you-will-learn` |
| `options-checker`: BEGIN/END balanced | `option-unbalanced` |
| `options-checker`: tab name non-empty | `option-missing-tabname` |
| `file-name-checker`: no uppercase in slug | `path-uppercase-slug` |
| `file-name-checker`: folder matches filename | `path-wrong-location` |

> Tasks 3–7 implement the UPDATE + NEW rows. DROP rows require no implementation.
