import {
  attr,
  defineRule,
  isElement,
  isText,
  meaningfulChildren,
  parentElement,
  setAttr,
  startTagOf,
  textContent,
  uniqueId,
  type CodemodResult,
  type Element,
  type FixContext,
} from "a11yfix-core";

const CONTROLS = new Set(["input", "select", "textarea"]);
const INLINE_TEXT = new Set(["span", "strong", "b", "em", "i", "small", "p", "div", "td", "th", "dt"]);
const MAX_LABEL = 80;

const isControl = (el: Element) =>
  CONTROLS.has(el.tagName) && !["hidden", "submit", "button", "reset", "image"].includes((attr(el, "type") ?? "").toLowerCase());

function countControls(el: Element): number {
  let n = 0;
  const walk = (e: Element) => {
    if (isControl(e)) n++;
    for (const c of e.childNodes) if (isElement(c)) walk(c);
  };
  walk(el);
  return n;
}

/** An element that only holds short text (inline formatting allowed, no controls). */
function textOnly(el: Element): string | null {
  if (!INLINE_TEXT.has(el.tagName) || countControls(el) > 0) return null;
  const text = textContent(el);
  return text && text.length <= MAX_LABEL ? text : null;
}

/**
 * Tier 0. Associates a control with text that is already on the page and
 * that unambiguously belongs to it:
 *   A. a bare text node next to the control, alone in the same parent
 *      ("Full name <input>", "<input type=checkbox> Send me the digest")
 *      -> wrap both in <label>;
 *   B. a short text-only element alone with the control in the same parent
 *      ("<span>Country</span> <select>") -> aria-labelledby;
 *   C. a table row "<td>Email</td><td><input></td>" with one control
 *      -> aria-labelledby the previous cell;
 *   D. otherwise, a non-empty placeholder -> aria-label.
 * Declines when there is more than one control, more than one candidate, or
 * no visible text: the right label then needs judgment.
 */
function fix(ctx: FixContext): CodemodResult | null {
  const el = ctx.element;
  if (!el || !ctx.startTag || !ctx.startTagRange || !isControl(el)) return null;
  if (attr(el, "aria-labelledby") !== undefined || attr(el, "aria-label") !== undefined) return null;
  const parent = parentElement(el);
  if (!parent || parent.tagName === "label") return null;
  const loc = el.sourceCodeLocation;
  if (!loc) return null;
  const { src } = ctx;
  const type = (attr(el, "type") ?? "").toLowerCase();
  const checkable = type === "checkbox" || type === "radio";

  const kids = meaningfulChildren(parent);
  if (kids.length === 2 && countControls(parent) === 1) {
    const [a, b] = kids as [typeof kids[number], typeof kids[number]];
    const other = a === el ? b : b === el ? a : null;
    const textFirst = b === el;

    // A. bare text node: wrap text + control in <label>.
    if (other && isText(other) && other.sourceCodeLocation && (textFirst || checkable)) {
      const raw = other.value;
      const text = raw.replace(/\s+/g, " ").trim();
      if (!text || text.length > MAX_LABEL) return null;
      const tStart = other.sourceCodeLocation.startOffset + (raw.length - raw.trimStart().length);
      const tEnd = other.sourceCodeLocation.endOffset - (raw.length - raw.trimEnd().length);
      const start = textFirst ? tStart : loc.startOffset;
      const end = textFirst ? loc.endOffset : tEnd;
      const before = src.slice(start, end);
      return { before, after: `<label>${before}</label>`, rationale: `wrapped the control and its adjacent text "${text}" in a <label>`, confidence: "high" };
    }

    // B. short text-only element before the control: aria-labelledby.
    if (other && isElement(other) && textFirst) {
      const text = textOnly(other);
      const ost = startTagOf(src, other);
      if (text && ost && other.tagName !== "td" && other.tagName !== "th") {
        return labelledBy(ctx, other, ost, text);
      }
    }
  }

  // C. table: <td>Label</td><td><control></td>, one control in the cell.
  if ((parent.tagName === "td" || parent.tagName === "th") && countControls(parent) === 1) {
    const row = parentElement(parent);
    const cells = row ? meaningfulChildren(row).filter(isElement) : [];
    const i = cells.indexOf(parent);
    const prev = i > 0 ? cells[i - 1] : undefined;
    if (prev && i === 1 && cells.length === 2) {
      const text = textOnly(prev);
      const pst = startTagOf(src, prev);
      if (text && pst) return labelledBy(ctx, prev, pst, text);
    }
  }

  // D. placeholder as the accessible name.
  const placeholder = (attr(el, "placeholder") ?? "").trim();
  if (placeholder) {
    return {
      before: ctx.startTag,
      after: setAttr(ctx.startTag, "aria-label", placeholder),
      rationale: `aria-label taken from the placeholder "${placeholder}"`,
      confidence: "medium",
    };
  }
  return null;
}

function labelledBy(
  ctx: FixContext,
  labelEl: Element,
  labelTag: { text: string; range: { start: number; end: number } },
  text: string,
): CodemodResult | null {
  const { src } = ctx;
  if (labelTag.range.start > ctx.startTagRange!.start) return null;
  let labelId = attr(labelEl, "id");
  let newLabelTag = labelTag.text;
  if (!labelId) {
    labelId = uniqueId(`${attr(ctx.element!, "name") ?? attr(ctx.element!, "id") ?? "field"}-label`, ctx.ids);
    newLabelTag = setAttr(labelTag.text, "id", labelId);
  }
  const before = src.slice(labelTag.range.start, ctx.startTagRange!.end);
  const middle = src.slice(labelTag.range.end, ctx.startTagRange!.start);
  const after = newLabelTag + middle + setAttr(ctx.startTag!, "aria-labelledby", labelId);
  return { before, after, rationale: `aria-labelledby points to the visible text "${text}"`, confidence: "high" };
}

export const label = defineRule({
  id: "label",
  version: "1.0.0",
  axe: "label",
  wcag: ["1.3.1", "3.3.2", "4.1.2"],
  level: 1,
  tier: 0,
  confidence: "high",
  description: "Form controls must have an accessible name, preferably from visible text.",
  declines: [
    "controls that already have aria-label or aria-labelledby",
    "controls with no short visible text right before them (or right after, for checkboxes and radios), no text-only element to point at, no two-cell table row and no placeholder",
    "several controls sharing one visible label (for example first and last name under one heading)",
    "label text longer than a short phrase",
  ],
  fix,
  guidance: [
    "Prefer associating visible text that is already on the page: wrap it with the control in a <label>, or point aria-labelledby at it.",
    "If there is no visible text, an aria-label that says what the field is for is acceptable.",
    "If you need an id for the association, make sure it is unique in the file.",
    "Do not remove the control and do not use a generic label such as 'input' or 'field'.",
  ].join("\n"),
});
