/**
 * CLI helper: reads findings.json from CWD and emits GitHub Actions
 * ::warning:: / ::notice:: commands so they appear as PR annotations.
 *
 * Called by the reusable workflow after normalize-findings.js produces findings.json.
 */
import { readFileSync } from "node:fs";
import { renderAnnotations } from "./normalize-findings.js";

const findings = JSON.parse(readFileSync("findings.json", "utf8"));
const out = renderAnnotations(findings);
if (out) process.stdout.write(out + "\n");
