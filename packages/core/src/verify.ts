// The verifier. a11yfix does not trust its own patches: each one is applied
// to a copy of the page, the copy is re-audited with the full rule set, and
// the patch is kept only if
//   1. the original violation is gone from the target node, and
//   2. no violation appeared anywhere else on the page, and
//   3. it did not "fix" the violation by hiding or deleting things.
//
// Node identity across the edit: violations are keyed by (rule, source
// offset of the element). Offsets before the edit are unchanged, offsets
// after it shift by the size delta, and anything starting inside the edited
// span is keyed to the span itself.

import { auditSource, type AuditResult, type PageViolation } from "./audit.js";
import type { AppliedPatch } from "./apply.js";
import { allElements, attr, parseSource, type Element } from "./source.js";
import type { Rule } from "./rule.js";
import type { Finding, SuspicionLayer, Verification, ViolationRef } from "./types.js";
import { validatePatch } from "./validate.js";
import { deepCheck, probeOptions, type DeepCheckOptions } from "./deepcheck.js";
import type { Impact } from "./types.js";

export interface VerifyInput {
  file: string;
  src: string;
  finding: Finding;
  /** The raw patch object (validated here). */
  patch: unknown;
  /** Audit of the unpatched source. Pass it in to avoid re-auditing per patch. */
  baseline?: AuditResult;
  /** The rule that owns the finding; its verify() can add suspicion reasons. */
  rule?: Rule;
  /** Accessibility-tree, focus-order and visual checks. Omit to run axe-only verification. */
  checks?: DeepCheckOptions;
  /** New violations below this impact are reported but do not reject the patch. Default: every impact counts. */
  regressionImpact?: Impact;
}

const IMPACT_ORDER: Impact[] = ["minor", "moderate", "serious", "critical"];
const atLeast = (i: Impact | null | undefined, min: Impact) =>
  IMPACT_ORDER.indexOf(i ?? "critical") >= IMPACT_ORDER.indexOf(min);

export interface VerifyOutput {
  verification: Verification;
  /** Patched source, when the patch could be applied. */
  patched: string | null;
}

const REGION = "R";

/** Deep-check reasons carry their layer as a prefix (see deepcheck.ts). */
function deepLayer(reason: string): SuspicionLayer {
  if (reason.startsWith("accessibility tree:")) return "accessibility-tree";
  if (reason.startsWith("focus order:")) return "focus-order";
  return "visual";
}

export async function verifyPatch(input: VerifyInput): Promise<VerifyOutput> {
  const { file, src, finding } = input;
  const base: Omit<Verification, "status" | "reason"> = {
    findingId: finding.id,
    ruleGone: false,
    newViolations: [],
    suspicious: false,
  };

  const v = validatePatch(src, finding, input.patch);
  if (!v.ok) return { verification: { ...base, status: v.status, reason: v.reason }, patched: null };
  const applied = v.applied;

  const probe = input.checks ? probeOptions(input.checks) : undefined;
  let baseline = input.baseline ?? (await auditSource(file, src, { rules: [finding.ruleId], probe }));
  if (probe && !baseline.probe) baseline = await auditSource(file, src, { rules: baseline.rules, probe });
  // Re-audit with the same rules as the baseline (plus the target's rule, in
  // case it is not a WCAG-tagged rule such as heading-order).
  const rules = Array.from(new Set([...baseline.rules, finding.ruleId]));
  let after: AuditResult;
  try {
    after = await auditSource(file, applied.patched, { rules, probe });
  } catch (err) {
    return {
      verification: {
        ...base,
        status: "rejected_apply_failed",
        reason: `patched page could not be audited: ${(err as Error).message}`,
        diff: applied.diff,
      },
      patched: applied.patched,
    };
  }

  const cmp = compare(baseline.all, after.all, finding, applied);
  const min = input.regressionImpact;
  const tolerated = min ? cmp.newViolations.filter((v) => !atLeast(v.impact, min)) : [];
  if (min) cmp.newViolations = cmp.newViolations.filter((v) => atLeast(v.impact, min));
  const sus = suspicionReasons(src, applied, finding);
  const flaggedBy = new Set<SuspicionLayer>(sus.length ? ["static"] : []);
  let checks: Verification["checks"];
  if (input.checks && baseline.probe && after.probe) {
    const deep = await deepCheck(src, applied, baseline.probe, after.probe, finding, input.checks);
    sus.push(...deep.reasons);
    for (const r of deep.reasons) flaggedBy.add(deepLayer(r));
    checks = { ax: deep.ax, focus: deep.focus, visual: deep.visual };
  }
  if (input.rule?.verify) {
    const oldElements = allElements(parseSource(src));
    const newElements = allElements(parseSource(applied.patched));
    const own = input.rule.verify({ finding, src, applied, oldElements, newElements });
    sus.push(...own);
    if (own.length) flaggedBy.add("rule");
  }
  const verification: Verification = {
    ...base,
    ruleGone: cmp.ruleGone,
    newViolations: cmp.newViolations,
    suspicious: sus.length > 0,
    reason: null,
    status: "verified",
    diff: applied.diff,
    ...(tolerated.length ? { toleratedViolations: tolerated } : {}),
    ...(flaggedBy.size ? { flaggedBy: [...flaggedBy] } : {}),
    ...(checks ? { checks } : {}),
  };

  if (!cmp.ruleGone) {
    verification.status = "rejected_persists";
    verification.reason = `${finding.ruleId} is still reported on the target node`;
  } else if (cmp.newViolations.length > 0) {
    verification.status = "rejected_regression";
    verification.reason = `introduced ${cmp.newViolations.length} new violation(s): ${summarize(cmp.newViolations)}`;
  } else if (sus.length > 0) {
    verification.status = "rejected_suspicious";
    verification.reason = sus.join("; ");
  }
  return { verification, patched: applied.patched };
}

/* ---------------------------------------------------------------------- */

function keyBefore(v: PageViolation, ap: AppliedPatch): string {
  if (!v.sourceRange) return `${v.ruleId}|sel:${v.selector}`;
  const o = v.sourceRange.start;
  if (o < ap.editStart) return `${v.ruleId}|${o}`;
  if (o >= ap.editEndOld) return `${v.ruleId}|${o + (ap.editEndNew - ap.editEndOld)}`;
  return `${v.ruleId}|${REGION}`;
}

function keyAfter(v: PageViolation, ap: AppliedPatch): string {
  if (!v.sourceRange) return `${v.ruleId}|sel:${v.selector}`;
  const o = v.sourceRange.start;
  if (o >= ap.editStart && o < ap.editEndNew) return `${v.ruleId}|${REGION}`;
  return `${v.ruleId}|${o}`;
}

export function compare(
  before: PageViolation[],
  after: PageViolation[],
  finding: Finding,
  ap: AppliedPatch,
): { ruleGone: boolean; newViolations: ViolationRef[] } {
  const targetKey = keyBefore(
    { ruleId: finding.ruleId, impact: finding.impact, selector: finding.selector, sourceRange: finding.sourceRange, sourceLines: finding.sourceLines },
    ap,
  );
  const afterKeys = after.map((v) => keyAfter(v, ap));
  const ruleGone = !afterKeys.includes(targetKey);

  // Multiset difference: after - before.
  const pool = new Map<string, number>();
  for (const v of before) {
    const k = keyBefore(v, ap);
    pool.set(k, (pool.get(k) ?? 0) + 1);
  }
  const newViolations: ViolationRef[] = [];
  after.forEach((v, i) => {
    const k = afterKeys[i]!;
    const n = pool.get(k) ?? 0;
    if (n > 0) pool.set(k, n - 1);
    else newViolations.push({ ruleId: v.ruleId, impact: v.impact, selector: v.selector, sourceLines: v.sourceLines });
  });
  return { ruleGone, newViolations };
}

function summarize(vs: ViolationRef[]): string {
  return vs
    .slice(0, 5)
    .map((v) => `${v.ruleId} at ${v.sourceLines ? `line ${v.sourceLines.start}` : v.selector}`)
    .join(", ");
}

/* ---------------------------------------------------------------------- */
/* Suspicion: patches that make axe quiet without making the page better. */
/* ---------------------------------------------------------------------- */

export const GENERIC_ALT = new Set([
  "image",
  "imagen",
  "foto",
  "picture",
  "icon",
  "photo",
  "img",
  "graphic",
  "logo",
  "banner",
  "spacer",
  "placeholder",
]);

const FILENAME_RE = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i;

const HEADING_RE = /^h[1-6]$/;

function closest(el: Element, pred: (el: Element) => boolean): Element | null {
  let cur = el.parentNode as Element | null;
  while (cur && cur.tagName) {
    if (pred(cur)) return cur;
    cur = cur.parentNode as Element | null;
  }
  return null;
}

/** Text, aria-label/title, or non-empty img alt anywhere inside `el`. */
function hasAccessibleText(el: Element): boolean {
  if ((attr(el, "aria-label") ?? "").trim() || (attr(el, "aria-labelledby") ?? "").trim() || (attr(el, "title") ?? "").trim()) return true;
  for (const c of el.childNodes) {
    if ("value" in c && c.nodeName === "#text" && (c as { value: string }).value.trim()) return true;
    if ((c as Element).tagName) {
      const ce = c as Element;
      if (ce.tagName === "img" && (attr(ce, "alt") ?? "").trim()) return true;
      if (hasAccessibleText(ce)) return true;
    }
  }
  return false;
}

function count(els: Element[], pred: (el: Element) => boolean): number {
  let n = 0;
  for (const el of els) if (pred(el)) n++;
  return n;
}

function values(els: Element[], name: string, pred: (el: Element) => boolean): string[] {
  const out: string[] = [];
  for (const el of els) {
    if (!pred(el)) continue;
    const v = attr(el, name);
    if (v !== undefined) out.push(v);
  }
  return out;
}

function multisetMinus(a: string[], b: string[]): string[] {
  const pool = new Map<string, number>();
  for (const x of b) pool.set(x, (pool.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const n = pool.get(x) ?? 0;
    if (n > 0) pool.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

export function isGenericText(value: string): boolean {
  const t = value.trim().toLowerCase().replace(/[.!]$/, "");
  if (GENERIC_ALT.has(t)) return true;
  if (FILENAME_RE.test(t)) return true;
  // "image of", "picture 1", "icon-2"
  return /^(image|imagen|foto|picture|icon|photo|img|graphic)[\s_-]*(\d+|of)?$/.test(t);
}

function words(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when every word of `text` already appears in the file name of `src`. */
export function restatesFileName(text: string, src: string): boolean {
  const base = (src.split(/[\\/?#]/).filter(Boolean).pop() ?? "").replace(/\.[a-z0-9]+$/i, "");
  const fileWords = new Set(words(base));
  const textWords = words(text);
  return textWords.length > 0 && fileWords.size > 0 && textWords.every((w) => fileWords.has(w));
}

export function suspicionReasons(src: string, ap: AppliedPatch, finding: Finding): string[] {
  const oldEls = allElements(parseSource(src));
  const newEls = allElements(parseSource(ap.patched));
  const reasons: string[] = [];

  // 1. The target element disappeared. Heading rules may legitimately change
  //    the tag name, so headings are counted as one category.
  const tag = finding.context.tagName || (finding.sourceSnippet?.match(/^<([a-zA-Z0-9-]+)/)?.[1] ?? "").toLowerCase();
  if (tag) {
    const sameKind = HEADING_RE.test(tag)
      ? (el: Element) => HEADING_RE.test(el.tagName)
      : (el: Element) => el.tagName === tag;
    const was = count(oldEls, sameKind);
    const now = count(newEls, sameKind);
    if (now < was) reasons.push(`target element removed (<${tag}> count ${was} -> ${now})`);
  }

  // 2. aria-hidden="true" added.
  const hidden = (el: Element) => (attr(el, "aria-hidden") ?? "").trim().toLowerCase() === "true";
  if (count(newEls, hidden) > count(oldEls, hidden)) reasons.push('added aria-hidden="true"');

  // 2b. inert added: removes the subtree from the accessibility tree and the
  //     tab order, and axe stops checking it.
  const inert = (el: Element) => attr(el, "inert") !== undefined;
  if (count(newEls, inert) > count(oldEls, inert)) reasons.push("added inert");

  // 3. role="presentation" / role="none" added.
  const presentational = (el: Element) => /^(presentation|none)$/i.test((attr(el, "role") ?? "").trim());
  if (count(newEls, presentational) > count(oldEls, presentational)) reasons.push('added role="presentation" or role="none"');

  // 4. Content hidden from everyone (hidden attribute, display:none, visibility:hidden).
  const visuallyHidden = (el: Element) =>
    attr(el, "hidden") !== undefined || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(el, "style") ?? "");
  if (count(newEls, visuallyHidden) > count(oldEls, visuallyHidden)) reasons.push("hid content (hidden / display:none / visibility:hidden)");

  // 4b. Content made invisible while staying in the DOM (a classic way to
  //     "fix" contrast): clip/clip-path, opacity 0, font-size 0, off-screen
  //     text-indent, in inline styles.
  const invisible = (el: Element) =>
    /clip-path\s*:\s*inset\(\s*(50|100)%|clip\s*:\s*rect\(\s*0|opacity\s*:\s*0(\.0+)?\s*(;|$)|font-size\s*:\s*0(px|em|rem)?\s*(;|$)|text-indent\s*:\s*-\d{3,}/i.test(
      attr(el, "style") ?? "",
    );
  if (count(newEls, invisible) > count(oldEls, invisible)) reasons.push("made content invisible (clip, clip-path, opacity:0, font-size:0 or text-indent)");

  // 5. Generic or file-name text alternatives.
  const imgLike = (el: Element) =>
    el.tagName === "img" || el.tagName === "area" || (el.tagName === "input" && (attr(el, "type") ?? "").toLowerCase() === "image") || attr(el, "role") === "img";
  for (const name of ["alt", "aria-label", "title"]) {
    const added = multisetMinus(values(newEls, name, imgLike), values(oldEls, name, imgLike));
    const bad = added.filter(isGenericText);
    if (bad.length) reasons.push(`generic ${name}: ${bad.map((b) => JSON.stringify(b)).join(", ")}`);
  }

  // 5b. Text alternatives that only restate the image's file name
  //     (src="team-photo.jpg" -> alt="Team photo"): no information beyond the URL.
  for (const el of newEls) {
    if (!imgLike(el)) continue;
    const start = el.sourceCodeLocation?.startOffset ?? -1;
    if (start < ap.editStart || start >= ap.editEndNew) continue;
    const text = attr(el, "alt") ?? attr(el, "aria-label");
    const srcAttr = attr(el, "src");
    if (text && srcAttr && restatesFileName(text, srcAttr)) {
      reasons.push(`text alternative ${JSON.stringify(text)} only restates the file name "${srcAttr.split(/[\\/]/).pop()}"`);
    }
  }

  // 6. alt="" on an image that is the only content of a link or button. The
  //    image-alt violation disappears, but the control is still nameless
  //    (link-name / button-name were already failing, so the regression check
  //    cannot see it as new).
  for (const el of newEls) {
    if (el.tagName !== "img" || attr(el, "alt") !== "") continue;
    const start = el.sourceCodeLocation?.startOffset ?? -1;
    if (start < ap.editStart || start >= ap.editEndNew) continue;
    const control = closest(el, (p) => p.tagName === "a" || p.tagName === "button");
    if (control && !hasAccessibleText(control)) {
      reasons.push(`alt="" on the only content of a <${control.tagName}>, which is left without a name`);
    }
  }

  // 7. A focusable, non-native element left without any role (typically an
  //    invalid role="buton" deleted instead of corrected): keyboard users can
  //    reach it, but it no longer says what it is.
  const NATIVE = new Set(["a", "button", "input", "select", "textarea", "summary", "details", "area", "iframe", "audio", "video"]);
  const focusableNoRole = (el: Element) => {
    const ti = attr(el, "tabindex");
    return ti !== undefined && Number(ti) >= 0 && !NATIVE.has(el.tagName) && !(attr(el, "role") ?? "").trim();
  };
  if (count(newEls, focusableNoRole) > count(oldEls, focusableNoRole)) {
    reasons.push("left a focusable element without a role (role removed instead of corrected)");
  }

  // 8. Generic labels on form controls.
  if (finding.ruleId === "label") {
    const added = multisetMinus(values(newEls, "aria-label", () => true), values(oldEls, "aria-label", () => true));
    const bad = added.filter((t) => /^(input|field|text|textbox|label|form field)$/i.test(t.trim()) || t.trim().length < 2);
    if (bad.length) reasons.push(`generic aria-label: ${bad.map((b) => JSON.stringify(b)).join(", ")}`);
  }

  return reasons;
}
