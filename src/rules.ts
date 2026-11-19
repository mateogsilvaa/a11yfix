// The closed rule subset a11yfix audits and patches.
//
// Level 1 rules are structural fixes that are usually a single attribute or a
// single tag change. Level 2 (color-contrast) needs to reason about resolved
// colors up the tree and is harder to patch without breaking the design.

export interface RuleSpec {
  id: string;
  wcag: string[];
  level: 1 | 2;
  /** Rule-specific guidance appended to the prompt. */
  guidance: string;
}

export const RULES: RuleSpec[] = [
  {
    id: "image-alt",
    wcag: ["1.1.1"],
    level: 1,
    guidance: [
      "Describe the image's purpose (what it communicates or what it does), not its appearance.",
      "If the image is inside a link or button, the alt must describe the destination or action.",
      'If the image is purely decorative or its information is already in adjacent text, use alt="".',
      "Never use the file name, and never use generic words such as image, picture, photo, icon.",
    ].join("\n"),
  },
  {
    id: "label",
    wcag: ["1.3.1", "3.3.2", "4.1.2"],
    level: 1,
    guidance: [
      "Prefer a visible <label for=...> associated with the control when there is visible text you can reuse or wrap.",
      "If adding a visible label would change the layout, an aria-label or aria-labelledby pointing to existing visible text is acceptable.",
      "If you need an id for the association, make sure it is unique in the file.",
      "Do not use the placeholder as the only label; do not remove the control.",
    ].join("\n"),
  },
  {
    id: "heading-order",
    wcag: ["1.3.1"],
    level: 1,
    guidance: [
      "Heading levels should only increase by one. Fix the target heading's level so it fits the outline.",
      "Change the tag (for example <h4>...</h4> to <h3>...</h3>), keeping attributes and content. Change both the opening and closing tag.",
      "Do not convert headings into non-heading elements and do not change other headings.",
      "If changing the level would visibly change the font size, you may keep the old look by adding the old level's class only if one exists; otherwise just change the level.",
    ].join("\n"),
  },
  {
    id: "aria-allowed-attr",
    wcag: ["4.1.2"],
    level: 1,
    guidance:
      "Remove the ARIA attribute that is not allowed on this role, or, if the attribute reveals the intended role, fix the role instead. Do not add aria-hidden.",
  },
  {
    id: "aria-required-attr",
    wcag: ["4.1.2"],
    level: 1,
    guidance:
      "Add the missing required ARIA attribute(s) with a value that matches the element's current state as shown in the markup (for example aria-checked reflecting whether it looks checked). Do not remove the role unless it is clearly wrong.",
  },
  {
    id: "aria-valid-attr-value",
    wcag: ["4.1.2"],
    level: 1,
    guidance:
      "Replace the invalid ARIA attribute value with a valid one that preserves the evident intent (for example an aria-labelledby/aria-controls that points at an existing id, or true/false for boolean attributes). If no valid value preserves intent, remove the attribute.",
  },
  {
    id: "aria-roles",
    wcag: ["4.1.2"],
    level: 1,
    guidance:
      "Replace the invalid or abstract role with the valid WAI-ARIA role the author evidently intended, or remove the role attribute if the native element already has the right semantics. Never use role=presentation or role=none to silence the rule.",
  },
  {
    id: "color-contrast",
    wcag: ["1.4.3"],
    level: 2,
    guidance: [
      "The text must reach the required contrast ratio against its resolved background (see the contrast data).",
      "Prefer darkening (or lightening) the text color over changing the background, and keep the same hue where possible.",
      "Change the narrowest thing that fixes this element: an inline style on the element, or the single CSS declaration that sets its color if it lives in a <style> block in this file.",
      "Changing a shared CSS rule can affect other elements; that is acceptable only if it does not reduce their contrast.",
    ].join("\n"),
  },
];

export const RULE_IDS = RULES.map((r) => r.id);

export function rulesForLevel(level: 1 | 2): string[] {
  return RULES.filter((r) => r.level <= level).map((r) => r.id);
}

export function ruleSpec(id: string): RuleSpec | undefined {
  return RULES.find((r) => r.id === id);
}

/**
 * Tags used for regression detection. A patch is judged against the whole
 * WCAG 2.x A/AA rule set, not only the subset we patch: a fix that sets
 * alt="" inside a link silences image-alt but breaks link-name, and we want
 * to see that.
 */
export const REGRESSION_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

/** WCAG success criteria from axe tags such as "wcag111" -> "1.1.1". */
export function wcagFromTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(t);
    if (m) out.push(`${m[1]}.${m[2]}.${m[3]}`);
  }
  return out;
}
