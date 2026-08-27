import { frontmatterRules } from "./frontmatter.js";
import { bodyRules } from "./body.js";
import { validationRules } from "./validation.js";
import { optionRules } from "./options.js";
import { pathRules } from "./paths.js";
import { tagRules } from "./tags.js";

// allRules is the flat array of all registered rule functions.
// Tasks 3–7 append their rule arrays here.
export const allRules = [
  ...frontmatterRules,
  ...bodyRules,
  ...validationRules,
  ...optionRules,
  ...pathRules,
  ...tagRules,
];
