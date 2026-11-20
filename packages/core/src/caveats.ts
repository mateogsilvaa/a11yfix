// The truth every result carries, whatever the surface (MCP server, GitHub
// Action). One wording, defined once: a surface that rephrases it drifts.

export const CONFORMANCE = "axe-clean on the checked rules, not WCAG conformance";

export const CAVEATS = [
  "verified means: axe-core no longer reports the violation, no new WCAG 2.x A/AA violation appeared, and the static, accessibility-tree, focus-order and visual checks found nothing worse. It is not a human review.",
  "skipped findings were not fixed: they need judgment (tier 1, no model configured) or a tier-0 codemod declined them by design (see the rules tool).",
  "suspicious patches need human review; with strict (the default) they are not in the patch.",
  "automated checks cover a subset of WCAG; most success criteria can only be judged by a person.",
  "Do not tell the user that the page is accessible or WCAG conformant.",
] as const;

export const WARNING =
  "WARNING: a11yfix results are axe-clean on the checked rules, not WCAG conformance. Do not tell the user the page is accessible; report what was verified and what still needs a person.";
