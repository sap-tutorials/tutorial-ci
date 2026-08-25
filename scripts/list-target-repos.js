import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Returns true iff the given CircleCI config text references the saptutorials/tutorial-checker orb.
 * Retained for reference/tests; enumeration now keys off tutorial CONTENT (a `tutorials/`
 * directory), because CircleCI is being removed and cannot be relied on as the signal.
 * @param {string|null} circleCiConfigText
 * @returns {boolean}
 */
export function isTargetRepo(circleCiConfigText) {
  if (!circleCiConfigText) return false;
  return circleCiConfigText.includes("saptutorials/tutorial-checker");
}

/**
 * Tooling / template / infra repos that are NOT tutorial content and must never
 * receive the PR-checks callers via rollout (templates are seeded separately).
 */
export const EXCLUDED_REPOS = new Set([
  "tutorial-ci",
  "tutorial-checker",
  "tutorial-checker-orb",
  "tutorial-actions",
  "repository-template",
  "tutorial-repo-template",
  "tutorial-repo-Contribution-template",
  ".github",
  "sapcommunity",
]);

/**
 * A repo is a tutorial content repo (rollout target) iff it is NOT excluded AND
 * either (a) has a top-level `tutorials/` directory, OR (b) still references the
 * tutorial-checker CircleCI orb. The union covers both repos already cleaned of
 * CircleCI (have `tutorials/`) and content repos that are currently empty of a
 * tutorials/ dir but were set up for tutorial checking (e.g. ai-core).
 * @param {string} repoName bare name (no owner)
 * @returns {boolean}
 */
export function hasTutorialsDir(repoName) {
  if (EXCLUDED_REPOS.has(repoName)) return false;
  const res = ghApi(`repos/sap-tutorials/${repoName}/contents/tutorials`, ["--jq", "type"]);
  // A directory listing returns a JSON array; `--jq type` prints "array".
  return res !== null && res.trim() === "array";
}

/**
 * True iff the repo still has a `.circleci/config.yml` referencing the tutorial-checker orb.
 * @param {string} repoName bare name (no owner)
 * @returns {boolean}
 */
export function hasOrbReference(repoName) {
  const res = ghApi(`repos/sap-tutorials/${repoName}/contents/.circleci/config.yml`, ["--jq", ".content"]);
  if (!res) return false;
  const b64 = res.trim();
  if (!b64 || b64 === "null") return false;
  try {
    return isTargetRepo(Buffer.from(b64.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    return false;
  }
}

/**
 * True iff the repo is a rollout target (content signal, tooling/templates excluded).
 * @param {string} repoName bare name (no owner)
 * @returns {boolean}
 */
export function isContentTarget(repoName) {
  if (EXCLUDED_REPOS.has(repoName)) return false;
  return hasTutorialsDir(repoName) || hasOrbReference(repoName);
}

/**
 * Run `gh api` safely with execFileSync (no shell, args as array).
 * Returns stdout string or null on error.
 */
function ghApi(endpoint, extraArgs = []) {
  try {
    return execFileSync("gh", ["api", endpoint, ...extraArgs], { encoding: "utf8" });
  } catch {
    return null;
  }
}

/**
 * Enumerate all repos in the sap-tutorials org that reference the tutorial-checker orb.
 * Uses `gh api` for pagination and fetches each .circleci/config.yml via the GitHub API.
 * @param {{ dryRun?: boolean, only?: string[] }} options
 * @returns {Promise<string[]>} list of repo full names
 */
export async function listTargetRepos({ dryRun = false, only = [] } = {}) {
  const targets = [];
  let page = 1;

  while (true) {
    const result = ghApi(
      `orgs/sap-tutorials/repos?per_page=100&page=${page}&type=all`,
      ["--jq", ".[].full_name"]
    );
    if (!result) break;

    const repos = result.trim().split("\n").filter(Boolean);
    if (repos.length === 0) break;

    for (const repo of repos) {
      const repoName = repo.replace("sap-tutorials/", "");
      if (only.length > 0 && !only.includes(repoName) && !only.includes(repo)) continue;

      // Target = tutorial content repo: has a `tutorials/` dir OR references the
      // tutorial-checker orb (union), excluding tooling/templates. CircleCI alone
      // is not relied on (being removed), but still counts a repo in.
      if (isContentTarget(repoName)) {
        targets.push(repo);
      }
    }

    if (repos.length < 100) break;
    page++;
  }

  return targets;
}

// CLI mode — only runs when invoked directly, not when imported as a module
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx !== -1 ? args[onlyIdx + 1].split(",").map((s) => s.trim()) : [];

  const targets = await listTargetRepos({ dryRun, only });

  if (dryRun) {
    console.log("Dry-run mode — tutorial content repos (have a tutorials/ directory), excluding tooling/templates:");
    targets.forEach((r) => console.log(`  ${r}`));
    console.log(`\nTotal: ${targets.length} repo(s)`);
  } else {
    console.log(JSON.stringify(targets));
  }
}
