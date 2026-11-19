// WAI-ARIA 1.2 data used by the codemods. Deliberately small: only what the
// codemods need to decide whether a fix is mechanical.

/** Concrete (non-abstract) WAI-ARIA 1.2 roles, excluding presentation/none. */
export const CONCRETE_ROLES = [
  "alert", "alertdialog", "application", "article", "banner", "blockquote", "button", "caption", "cell",
  "checkbox", "code", "columnheader", "combobox", "complementary", "contentinfo", "definition", "deletion",
  "dialog", "document", "emphasis", "feed", "figure", "form", "generic", "grid", "gridcell", "group",
  "heading", "img", "insertion", "link", "list", "listbox", "listitem", "log", "main", "marquee", "math",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "meter", "navigation", "note",
  "option", "paragraph", "progressbar", "radio", "radiogroup", "region", "row", "rowgroup", "rowheader",
  "scrollbar", "search", "searchbox", "separator", "slider", "spinbutton", "status", "strong", "subscript",
  "superscript", "switch", "tab", "table", "tablist", "tabpanel", "term", "textbox", "time", "timer",
  "toolbar", "tooltip", "tree", "treegrid", "treeitem",
];

export const ABSTRACT_ROLES = [
  "command", "composite", "input", "landmark", "range", "roletype", "section", "sectionhead", "select",
  "structure", "widget", "window",
];

/** Roles with required states/properties (axe aria-required-attr). */
export const REQUIRED_ATTRS: Record<string, string[]> = {
  checkbox: ["aria-checked"],
  combobox: ["aria-expanded"],
  heading: [],
  menuitemcheckbox: ["aria-checked"],
  menuitemradio: ["aria-checked"],
  meter: ["aria-valuenow"],
  radio: ["aria-checked"],
  scrollbar: ["aria-controls", "aria-valuenow"],
  slider: ["aria-valuenow"],
  switch: ["aria-checked"],
};

/** Roles that require owned elements or a specific parent: correcting into them can create new violations. */
export const STRUCTURAL_ROLES = new Set([
  "list", "listbox", "menu", "menubar", "grid", "table", "row", "rowgroup", "tablist", "tree", "treegrid", "feed",
  "listitem", "option", "menuitem", "menuitemcheckbox", "menuitemradio", "tab", "cell", "gridcell",
  "columnheader", "rowheader", "treeitem", "radiogroup",
]);

/** Roles that need an accessible name from content or attributes. */
export const NAMED_ROLES = new Set([
  "button", "link", "checkbox", "radio", "switch", "menuitem", "tab", "treeitem", "option", "img", "dialog",
  "alertdialog", "progressbar", "meter", "slider", "spinbutton", "textbox", "searchbox", "combobox", "listbox",
]);

export const BOOLEAN_ATTRS = new Set([
  "aria-atomic", "aria-busy", "aria-disabled", "aria-modal", "aria-multiline", "aria-multiselectable",
  "aria-readonly", "aria-required",
]);

/** true / false / undefined */
export const TRUE_FALSE_UNDEFINED_ATTRS = new Set(["aria-expanded", "aria-hidden", "aria-selected"]);

/** true / false / mixed */
export const TRISTATE_ATTRS = new Set(["aria-checked", "aria-pressed"]);

/** Token attributes and their allowed values. */
export const TOKEN_ATTRS: Record<string, string[]> = {
  "aria-autocomplete": ["inline", "list", "both", "none"],
  "aria-current": ["page", "step", "location", "date", "time", "true", "false"],
  "aria-haspopup": ["false", "true", "menu", "listbox", "tree", "grid", "dialog"],
  "aria-invalid": ["grammar", "false", "spelling", "true"],
  "aria-live": ["assertive", "off", "polite"],
  "aria-orientation": ["horizontal", "vertical", "undefined"],
  "aria-sort": ["ascending", "descending", "none", "other"],
};

export const IDREF_ATTRS = new Set([
  "aria-activedescendant", "aria-controls", "aria-describedby", "aria-details", "aria-errormessage",
  "aria-flowto", "aria-labelledby", "aria-owns",
]);

/** State attributes whose removal would lose author intent (the fix needs judgment). */
export const STATE_ATTRS = new Set(["aria-checked", "aria-pressed", "aria-selected", "aria-expanded", "aria-current"]);

/** Attribute names out of axe check data: ['aria-x="v"'], {values: [...]}, or a string. */
export function attrNamesFromData(data: unknown): string[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { values?: unknown }).values)
      ? (data as { values: unknown[] }).values
      : [data];
  const names = new Set<string>();
  for (const d of list) {
    if (typeof d !== "string") continue;
    const m = /^(aria-[a-z]+)/i.exec(d.trim());
    if (m) names.add(m[1]!.toLowerCase());
  }
  return [...names];
}
