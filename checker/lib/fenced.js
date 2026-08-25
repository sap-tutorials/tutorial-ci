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
// Matches an opening fence line: ``` or ~~~ optionally followed by a language tag or other text.
// A language tag only ever appears on the OPENING fence, never the closing one.
const FENCE_OPEN = /^(```+|~~~+)/;

// Matches a CLOSING fence line: ONLY fence chars plus optional trailing whitespace.
const FENCE_CLOSE_BACKTICK = /^```+\s*$/;
const FENCE_CLOSE_TILDE    = /^~~~+\s*$/;

export function buildFenceSet(lines) {
  const fenced = new Set();
  let inFence = false;
  let fenceChar = null; // "```" or "~~~"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFence) {
      // Opening fence: line starts with ``` or ~~~  (language tag is OK here)
      const m = FENCE_OPEN.exec(line);
      if (m) {
        inFence = true;
        fenceChar = m[1].startsWith("`") ? "```" : "~~~";
        // The opening fence line itself is NOT added — it's not content inside the fence.
      }
    } else {
      // Closing fence: line must be ONLY fence chars (+ optional trailing whitespace).
      // This prevents a language-tagged opener like "```bash" from being misread as a close.
      const isClose = fenceChar === "```"
        ? FENCE_CLOSE_BACKTICK.test(line)
        : FENCE_CLOSE_TILDE.test(line);

      if (isClose) {
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
