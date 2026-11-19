// a11yfix-rules-core: the core rule set.

import { RuleRegistry, type Rule } from "a11yfix-core";
import { ariaAllowedAttr } from "./aria-allowed-attr.js";
import { ariaRoles } from "./aria-roles.js";
import { ariaValidAttrValue } from "./aria-valid-attr-value.js";
import { headingOrder } from "./heading-order.js";
import { imageAlt } from "./image-alt.js";
import { ariaRequiredAttr, colorContrast } from "./judgment-rules.js";
import { label } from "./label.js";

export { ariaAllowedAttr, ariaRequiredAttr, ariaRoles, ariaValidAttrValue, colorContrast, headingOrder, imageAlt, label };

/** Every core rule, in report order. */
export const coreRules: Rule[] = [
  imageAlt,
  label,
  headingOrder,
  ariaAllowedAttr,
  ariaRequiredAttr,
  ariaValidAttrValue,
  ariaRoles,
  colorContrast,
];

export function createCoreRegistry(): RuleRegistry {
  return new RuleRegistry(coreRules);
}
