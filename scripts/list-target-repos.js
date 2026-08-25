import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Returns true iff the given CircleCI config text references the saptutorials/tutorial-checker orb.
 * @param {string|null} circleCiConfigText
 * @returns {boolean}
 */
export function isTargetRepo(circleCiConfigText) {
  if (!circleCiConfigText) return false;
  return circleCiConfigText.includes("saptutorials/tutorial-checker");
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
      `orgs/sap-tutorials/repos?per_page=100&page=${page}&type=internal`,
      ["--jq", ".[].full_name"]
    );
    if (!result) break;

    const repos = result.trim().split("\n").filter(Boolean);
    if (repos.length === 0) break;

    for (const repo of repos) {
      const repoName = repo.replace("sap-tutorials/", "");
      if (only.length > 0 && !only.includes(repoName) && !only.includes(repo)) continue;

      // Fetch .circleci/config.yml content (base64-encoded by GitHub API)
      const contentResult = ghApi(
        `repos/${repo}/contents/.circleci/config.yml`,
        ["--jq", ".content"]
      );

      let configText = null;
      if (contentResult) {
        const b64 = contentResult.trim();
        if (b64 && b64 !== "null") {
          try {
            configText = Buffer.from(b64.replace(/\s/g, ""), "base64").toString("utf8");
          } catch {
            configText = null;
          }
        }
      }

      if (isTargetRepo(configText)) {
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
    console.log("Dry-run mode — target repos that reference saptutorials/tutorial-checker:");
    targets.forEach((r) => console.log(`  ${r}`));
    console.log(`\nTotal: ${targets.length} repo(s)`);
  } else {
    console.log(JSON.stringify(targets));
  }
}
