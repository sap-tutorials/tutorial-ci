/**
 * paths.js — Slug/path location rules.
 *
 * Rule ids: path-uppercase-slug, path-wrong-location
 */

const KNOWN_META_FILES = new Set([
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
]);

/**
 * @param {import("../index.js").Context} ctx
 * @returns {import("../index.js").FindingPartial[]}
 */
function checkPaths(ctx) {
  const findings = [];
  const filename = ctx.filename;

  if (!filename || !filename.endsWith(".md")) {
    return findings;
  }

  // Normalize to forward slashes
  const normalized = filename.replace(/\\/g, "/");

  // Check if this is under tutorials/...
  const tutorialsMatch = normalized.match(/^tutorials\//);

  if (tutorialsMatch) {
    // Check for uppercase letters in any path segment
    const segments = normalized.split("/");
    const hasUppercase = segments.some((seg) => /[A-Z]/.test(seg));
    if (hasUppercase) {
      findings.push({
        line: 1,
        severity: "warning",
        rule: "path-uppercase-slug",
        message: `Path contains uppercase letters — tutorial slugs must be lowercase-canonical (got: ${filename})`,
      });
    }
    return findings;
  }

  // Not under tutorials/ — check if it's a known meta file (basename only)
  const basename = normalized.split("/").pop();
  if (KNOWN_META_FILES.has(basename)) {
    return findings;
  }

  // .md file outside tutorials/<slug>/ and not a known meta file
  findings.push({
    line: 1,
    severity: "notice",
    rule: "path-wrong-location",
    message: `Markdown file is not under tutorials/<slug>/ — tutorials placed in the wrong folder will 404 (see "new tutorial 404s = wrong repo folder" gotcha). Got: ${filename}`,
  });

  return findings;
}

export const pathRules = [checkPaths];
