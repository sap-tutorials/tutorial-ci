import { frontmatterRules } from "./frontmatter.js";

// allRules is the flat array of all registered rule functions.
// Tasks 3–7 append their rule arrays here.
export const allRules = [
  ...frontmatterRules,
];
