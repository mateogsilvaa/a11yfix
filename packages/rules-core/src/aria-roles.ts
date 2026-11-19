import { attr, defineRule, levenshtein, setAttr, textContent, type CodemodResult, type FixContext } from "a11yfix-core";
import { ABSTRACT_ROLES, CONCRETE_ROLES, NAMED_ROLES, REQUIRED_ATTRS, STRUCTURAL_ROLES } from "./aria-data.js";

/**
 * Tier 0 for misspelled roles only: "buton" -> "button", "navigaton" ->
 * "navigation". The correction must be the unique closest valid role within
 * edit distance 2, and must not be a role that would immediately create a
 * different violation (required states, required children or parent, or a
 * required name the element does not have). Abstract roles ("range",
 * "widget") and unknown words need judgment and are declined.
 */
function fix(ctx: FixContext): CodemodResult | null {
  const el = ctx.element;
  if (!el || !ctx.startTag) return null;
  const raw = attr(el, "role");
  if (!raw) return null;
  const tokens = raw.trim().toLowerCase().split(/\s+/);
  if (tokens.length !== 1) return null;
  const token = tokens[0]!;
  if (token.length < 4 || ABSTRACT_ROLES.includes(token) || CONCRETE_ROLES.includes(token)) return null;

  const scored = CONCRETE_ROLES.map((r) => ({ r, d: levenshtein(token, r) })).sort((a, b) => a.d - b.d);
  const best = scored[0]!;
  if (best.d > 2 || scored[1]!.d === best.d) return null;
  const role = best.r;

  if (STRUCTURAL_ROLES.has(role)) return null;
  const required = REQUIRED_ATTRS[role] ?? [];
  if (required.some((a) => attr(el, a) === undefined)) return null;
  if (NAMED_ROLES.has(role) && !textContent(el) && !attr(el, "aria-label") && !attr(el, "aria-labelledby") && !attr(el, "title")) {
    return null;
  }

  return {
    before: ctx.startTag,
    after: setAttr(ctx.startTag, "role", role),
    rationale: `"${raw}" is not a WAI-ARIA role; "${role}" is the only valid role within edit distance ${best.d}`,
    confidence: "high",
  };
}

export const ariaRoles = defineRule({
  id: "aria-roles",
  version: "1.0.0",
  axe: "aria-roles",
  wcag: ["4.1.2"],
  level: 1,
  tier: 0,
  confidence: "high",
  description: "role attributes must hold valid, non-abstract WAI-ARIA roles.",
  fix,
  guidance:
    "Replace the invalid or abstract role with the valid WAI-ARIA role the author evidently intended (add any states that role requires, reflecting the element's current state), or remove the role attribute if the native element already has the right semantics. Never use role=presentation or role=none to silence the rule.",
});
