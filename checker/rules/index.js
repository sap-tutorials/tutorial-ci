import { frontmatterRules } from "./frontmatter.js";
import { bodyRules } from "./body.js";
import { validationRules } from "./validation.js";
import { optionRules } from "./options.js";
import { pathRules } from "./paths.js";
import { tagRules } from "./tags.js";
import { structureRules } from "./structure.js";

// allRules is the flat array of all registered rule functions.
// structureRules carry the only `error`-severity (blocking) findings; the
// workflow gate (scripts/gate-blocking.js) fails the PR check on those.
export const allRules = [
  ...frontmatterRules,
  ...bodyRules,
  ...validationRules,
  ...optionRules,
  ...pathRules,
  ...tagRules,
  ...structureRules,
];
