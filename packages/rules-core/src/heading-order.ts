import { allElements, attr, defineRule, type CodemodResult, type FixContext } from "a11yfix-core";

const HEADING = /^h([1-6])$/;

/**
 * Tier 0. Re-level the target heading to one below the previous heading,
 * move its siblings with it, and re-level any following heading the change
 * would break (see the walk below).
 *
 * Declines when the page uses role="heading"/aria-level (the source outline
 * would not match what assistive technology sees), when the browser's outline
 * differs from the source outline (hidden headings), or when the renumbering
 * would not fit in one small patch.
 */
function fix(ctx: FixContext): CodemodResult | null {
  const el = ctx.element;
  const m = el ? HEADING.exec(el.tagName) : null;
  if (!el || !m || !el.sourceCodeLocation) return null;
  const els = allElements(ctx.parsed);
  if (els.some((e) => attr(e, "role") === "heading" || attr(e, "aria-level") !== undefined)) return null;

  const outline = els.filter((e) => HEADING.test(e.tagName));
  const levels = outline.map((h) => Number(HEADING.exec(h.tagName)![1]));
  const dom = ctx.finding.context.headingOutline?.map((h) => h.level);
  if (!dom || dom.length !== levels.length || dom.some((l, i) => l !== levels[i])) return null;

  const idx = outline.indexOf(el);
  const level = levels[idx]!;
  const prev = idx > 0 ? levels[idx - 1]! : 0;
  const target = prev + 1;
  const delta = level - target;
  if (idx <= 0 || delta <= 0) return null;

  // Re-level the target, then walk the rest of its section (headings deeper
  // than the previous heading):
  //  - siblings (same level, same parent) move with the target, so the
  //    outline keeps saying the same thing;
  //  - a heading that is fine today but would skip a level after the change
  //    is re-levelled to one below its parent in the outline tree;
  //  - headings that already skip a level are left alone: they are their own
  //    findings.
  // If that adds up to more than one small patch, the codemod declines.
  const newLevels = [...levels];
  newLevels[idx] = target;
  const changed = [idx];
  let sameParent = true;
  for (let j = idx + 1; j < outline.length && levels[j]! > prev; j++) {
    if (levels[j]! < level) sameParent = false;
    if (sameParent && levels[j] === level) {
      newLevels[j] = target;
      changed.push(j);
      continue;
    }
    const wasOk = levels[j]! <= levels[j - 1]! + 1;
    const nowOk = levels[j]! <= newLevels[j - 1]! + 1;
    if (nowOk || !wasOk) continue;
    let parentNew = prev;
    for (let k = j - 1; k >= idx; k--) {
      if (levels[k]! < levels[j]!) {
        parentNew = newLevels[k]!;
        break;
      }
    }
    newLevels[j] = Math.min(levels[j]!, parentNew + 1);
    changed.push(j);
  }
  const section = changed.map((j) => outline[j]!);
  if (section.some((h) => !h.sourceCodeLocation?.startTag || !h.sourceCodeLocation.endTag)) return null;

  const start = el.sourceCodeLocation.startOffset;
  const end = section[section.length - 1]!.sourceCodeLocation!.endOffset;
  let after = "";
  let cursor = start;
  for (const [n, h] of section.entries()) {
    const loc = h.sourceCodeLocation!;
    const newLevel = newLevels[changed[n]!]!;
    const st = ctx.src.slice(loc.startTag!.startOffset, loc.startTag!.endOffset);
    const et = ctx.src.slice(loc.endTag!.startOffset, loc.endTag!.endOffset);
    after += ctx.src.slice(cursor, loc.startTag!.startOffset);
    after += st.replace(/^<h[1-6]/i, `<h${newLevel}`);
    after += ctx.src.slice(loc.startTag!.endOffset, loc.endTag!.startOffset);
    after += et.replace(/^<\/h[1-6]/i, `</h${newLevel}`);
    cursor = loc.endTag!.endOffset;
  }
  after += ctx.src.slice(cursor, end);
  const shifted = section.length > 1 ? ` together with ${section.length - 1} sibling or dependent heading(s), so the outline keeps its structure` : "";
  return {
    before: ctx.src.slice(start, end),
    after,
    rationale: `h${level} follows h${prev}: re-levelled to h${target}${shifted}`,
    confidence: "high",
  };
}

export const headingOrder = defineRule({
  id: "heading-order",
  version: "1.0.0",
  axe: "heading-order",
  wcag: ["1.3.1"],
  level: 1,
  tier: 0,
  confidence: "high",
  description: "Heading levels should only increase by one.",
  declines: [
    "pages with role=\"heading\" or aria-level (the outline is not only in the tags)",
    "pages whose rendered outline differs from the source outline",
    "changes that would need more than 6 lines or 2 places (re-levelling a long run of siblings)",
    "headings that were already out of order before the target (left for a person)",
  ],
  fix,
  guidance: [
    "Heading levels should only increase by one. Fix the target heading's level so it fits the outline.",
    "Change the tag (for example <h4>...</h4> to <h3>...</h3>), keeping attributes and content. Change both the opening and closing tag.",
    "If the target has sub-headings right after it, shift them by the same amount so the section keeps its structure.",
    "Do not convert headings into non-heading elements.",
  ].join("\n"),
});
