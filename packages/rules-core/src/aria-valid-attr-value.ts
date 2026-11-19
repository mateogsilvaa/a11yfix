import { attr, defineRule, levenshtein, setAttr, type CodemodResult, type FixContext } from "a11yfix-core";
import { BOOLEAN_ATTRS, IDREF_ATTRS, TOKEN_ATTRS, TRISTATE_ATTRS, TRUE_FALSE_UNDEFINED_ATTRS, attrNamesFromData } from "./aria-data.js";

const TRUTHY = new Set(["true", "yes", "1", "on"]);
const FALSY = new Set(["false", "no", "0", "off"]);

/** A valid value that keeps the author's evident intent, or null if that needs judgment. */
function correctedValue(name: string, value: string, ids: Set<string>): string | null {
  const v = value.trim().toLowerCase();
  if (BOOLEAN_ATTRS.has(name) || TRUE_FALSE_UNDEFINED_ATTRS.has(name) || TRISTATE_ATTRS.has(name)) {
    if (TRISTATE_ATTRS.has(name) && v === "mixed") return "mixed";
    if (TRUE_FALSE_UNDEFINED_ATTRS.has(name) && v === "undefined") return "undefined";
    const out = TRUTHY.has(v) ? "true" : FALSY.has(v) ? "false" : null;
    // Turning an invalid aria-hidden into "true" would hide content: never mechanical.
    if (name === "aria-hidden" && out === "true") return null;
    return out;
  }
  const tokens = TOKEN_ATTRS[name];
  if (tokens) return tokens.includes(v) ? v : null; // only case fixes
  if (IDREF_ATTRS.has(name)) {
    const parts = value.trim().split(/\s+/);
    const fixed: string[] = [];
    for (const p of parts) {
      if (ids.has(p)) {
        fixed.push(p);
        continue;
      }
      const near = [...ids].map((id) => ({ id, d: levenshtein(p, id) })).filter((x) => x.d <= 2).sort((a, b) => a.d - b.d);
      if (near.length === 0 || (near.length > 1 && near[1]!.d === near[0]!.d)) return null;
      fixed.push(near[0]!.id);
    }
    return fixed.join(" ");
  }
  return null; // numbers, free text: judgment
}

/**
 * Tier 0 when every invalid value has an unambiguous correction:
 * booleans written as yes/no/1/0 or in the wrong case, token values in the
 * wrong case, and id references with a single near-match id in the page
 * (edit distance at most 2). Anything else is declined.
 */
function fix(ctx: FixContext): CodemodResult | null {
  const el = ctx.element;
  if (!el || !ctx.startTag) return null;
  const names = ctx.finding.checks
    .filter((c) => c.id === "aria-valid-attr-value")
    .flatMap((c) => attrNamesFromData(c.data))
    .filter((n) => attr(el, n) !== undefined);
  if (!names.length) return null;
  let after = ctx.startTag;
  const changes: string[] = [];
  for (const n of names) {
    const value = attr(el, n)!;
    const fixed = correctedValue(n, value, ctx.ids);
    if (fixed === null || fixed === value) return null;
    after = setAttr(after, n, fixed);
    changes.push(`${n}="${value}" -> "${fixed}"`);
  }
  return { before: ctx.startTag, after, rationale: changes.join("; "), confidence: "high" };
}

export const ariaValidAttrValue = defineRule({
  id: "aria-valid-attr-value",
  version: "1.0.0",
  axe: "aria-valid-attr-value",
  wcag: ["4.1.2"],
  level: 1,
  tier: 0,
  confidence: "high",
  description: "ARIA attributes must have valid values.",
  fix,
  guidance:
    "Replace the invalid ARIA attribute value with a valid one that preserves the evident intent (for example an aria-labelledby/aria-controls that points at an existing id, or true/false for boolean attributes). If no valid value preserves intent, remove the attribute.",
});
