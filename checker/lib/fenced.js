/**
 * checker/lib/fenced.js
 *
 * Fence tracker: mirrors the parser's idea of whether a given line is inside
 * a fenced code block (``` or ~~~ fences).
 *
 * Usage:
 *   import { buildFenceSet } from "./fenced.js";
 *   const fenced = buildFenceSet(lines);
 *   if (fenced.has(i)) { /* line i is inside a fence, skip it *\/ }
 *
 * Returns a Set<number> of 0-based line indices that are INSIDE a fence
 * (the fence-open and fence-close lines themselves are NOT included — only
 * the content lines between them are, since we want to ignore tokens that
 * appear on interior lines).
 */
export function buildFenceSet(lines) {
  const fenced = new Set();
  let inFence = false;
  let fenceChar = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (!inFence) {
      // Opening fence: line starts with ``` or ~~~
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inFence = true;
        fenceChar = trimmed.startsWith("```") ? "```" : "~~~";
        // The opening fence line itself is NOT added — it's not content inside the fence.
      }
    } else {
      // Closing fence: line starts with the same fence characters
      if (trimmed.startsWith(fenceChar)) {
        inFence = false;
        fenceChar = null;
        // The closing fence line itself is NOT added.
      } else {
        // Interior content line — mark as fenced
        fenced.add(i);
      }
    }
  }

  return fenced;
}
