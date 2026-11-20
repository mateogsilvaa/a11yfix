import { attr, defineRule, removeAttr, type CodemodResult, type FixContext } from "verifa11y-core";
import { STATE_ATTRS, attrNamesFromData } from "./aria-data.js";

/**
 * Tier 0 for properties only. An ARIA attribute that is not allowed on the
 * element's role is ignored by assistive technology, so removing it leaves
 * the accessibility tree as it was and clears the violation. State
 * attributes (aria-checked, aria-pressed, aria-selected, aria-expanded,
 * aria-current) are declined: a state on the wrong role usually means the
 * role is wrong (a toggle button wanting aria-pressed, a tab wanting
 * role="tab"), and deleting it would throw that intent away.
 */
function fix(ctx: FixContext): CodemodResult | null {
  const el = ctx.element;
  if (!el || !ctx.startTag) return null;
  const names = ctx.finding.checks
    .filter((c) => c.id === "aria-allowed-attr")
    .flatMap((c) => attrNamesFromData(c.data))
    .filter((n) => attr(el, n) !== undefined);
  if (!names.length || names.some((n) => STATE_ATTRS.has(n))) return null;
  let after = ctx.startTag;
  for (const n of names) after = removeAttr(after, n);
  if (after === ctx.startTag) return null;
  return {
    before: ctx.startTag,
    after,
    rationale: `removed ${names.join(", ")}: not allowed on this element's role, so assistive technology ignores it`,
    confidence: "high",
  };
}

export const ariaAllowedAttr = defineRule({
  id: "aria-allowed-attr",
  version: "1.0.0",
  axe: "aria-allowed-attr",
  wcag: ["4.1.2"],
  level: 1,
  tier: 0,
  confidence: "high",
  description: "ARIA attributes must be allowed for the element's role.",
  declines: [
    "state attributes on the wrong role (aria-checked, aria-expanded, aria-pressed, aria-selected, aria-current, ...): the role is usually what is wrong",
  ],
  fix,
  guidance:
    "Remove the ARIA attribute that is not allowed on this role, or, if the attribute reveals the intended role (for example aria-pressed on a toggle, aria-selected on a tab), fix the role or use the attribute the role supports instead. Do not add aria-hidden.",
});
