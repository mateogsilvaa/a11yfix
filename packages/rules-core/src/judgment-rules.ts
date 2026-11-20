import { defineRule } from "verifa11y-core";

// Tier 1: no codemod. The missing value is a fact about the widget's state
// (is the checkbox checked? what is the slider's value?) that the markup does
// not say. A default such as aria-checked="false" satisfies axe whether or
// not it is true, which is exactly the kind of fix tier 0 must not make.
export const ariaRequiredAttr = defineRule({
  id: "aria-required-attr",
  version: "1.0.0",
  axe: "aria-required-attr",
  wcag: ["4.1.2"],
  level: 1,
  tier: 1,
  confidence: "medium",
  description: "Elements with ARIA roles must have the states and properties the role requires.",
  declines: [
    "always: the missing state (checked, expanded, level, ...) depends on how the widget behaves (tier 1, or a person)",
  ],
  guidance:
    "Add the missing required ARIA attribute(s) with a value that matches the element's current state as shown in the markup, classes or text (for example aria-checked reflecting whether it looks checked). If the state cannot be known, use the initial state the markup implies and set confidence to low. Do not remove the role unless it is clearly wrong.",
});

// Tier 1, level 2: fixing contrast means choosing a color, which is a design
// decision as much as an accessibility one.
export const colorContrast = defineRule({
  id: "color-contrast",
  version: "1.0.0",
  axe: "color-contrast",
  wcag: ["1.4.3"],
  level: 2,
  tier: 1,
  confidence: "medium",
  description: "Text must have sufficient contrast against its background.",
  declines: [
    "always: a contrast fix is a design decision (tier 1, or a person)",
  ],
  guidance: [
    "The text must reach the required contrast ratio against its resolved background (see the contrast data).",
    "Prefer darkening (or lightening) the text color over changing the background, and keep the same hue where possible.",
    "Change the narrowest thing that fixes this element: an inline style on the element, or the single CSS declaration that sets its color if it lives in a <style> block in this file.",
    "Changing a shared CSS rule can affect other elements; that is acceptable only if it does not reduce their contrast.",
  ].join("\n"),
});
