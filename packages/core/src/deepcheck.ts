// Verification beyond axe: what changed for users, not only for the rules.
//
//   accessibility tree  every element's computed role, name, states and
//                       focusability before and after the patch; a patch
//                       that removes a name, strips a role, hides a named or
//                       focusable element, drops a state or sets a generic
//                       name is suspicious even when axe is satisfied;
//   focus order         the Tab sequence before and after; elements leaving
//                       the tab order, or a reordered sequence, are
//                       suspicious;
//   visual              full-page screenshots per viewport; pixels that
//                       change outside the patched elements (a CSS edit that
//                       repaints half the page) beyond a threshold are
//                       suspicious; layout shifts are measured and reported.
//
// Identity across the edit is the same as for axe nodes: elements are keyed
// by source offset; offsets after the edit shift by the size delta; elements
// starting inside the edited span are matched by tag and order.

import type { AppliedPatch } from "./apply.js";
import { getBrowser } from "./browser.js";
import type { AxInfo, Probe, ProbeOptions, VisualCapture } from "./probe.js";
import { attr, elementChildren, lineOfOffset, parseSource, type Element } from "./source.js";
import type { Finding } from "./types.js";
import { isGenericText, restatesFileName } from "./verify.js";

export interface DeepCheckOptions {
  ax: boolean;
  focus: boolean;
  /** Viewports for visual comparison; empty: no visual check. */
  visual: Array<{ name: string; width: number; height: number }>;
  /** Max share of page pixels that may change outside the patched elements (0..1). */
  maxVisualChange: number;
  /** Max elements outside the patch that may move or resize; null: report only. */
  maxLayoutShift: number | null;
}

export const DEFAULT_DEEP_CHECKS: DeepCheckOptions = {
  ax: true,
  focus: true,
  visual: [{ name: "desktop", width: 1280, height: 900 }],
  maxVisualChange: 0.001,
  maxLayoutShift: null,
};

export function probeOptions(o: DeepCheckOptions): ProbeOptions {
  return { ax: o.ax, focus: o.focus, visual: o.visual };
}

export interface VisualDiff {
  viewport: string;
  /** Changed pixels outside the patched elements, as a share of the compared area. */
  changeOutside: number;
  changedPixelsOutside: number;
  /** Page size before -> after. */
  size: [number, number, number, number];
  /** Elements outside the patch whose box moved or resized. */
  layoutShift: number;
}

export interface DeepCheckResult {
  reasons: string[];
  ax?: string[];
  focus?: { before: number; after: number; lost: string[]; added: string[]; reordered: boolean };
  visual?: VisualDiff[];
}

/* ---------------------------------------------------------------------- */

interface Keyed {
  /** Element path -> identity key. */
  byPath: Map<string, string>;
  /** Identity key -> element. */
  byKey: Map<string, Element>;
  src: string;
}

const REGION = "R";

/**
 * Key every element of `src`. `side` says whether `src` is the original
 * (offsets after the edit are shifted into patched coordinates) or the
 * patched page.
 */
function keyElements(src: string, ap: AppliedPatch, side: "before" | "after"): Keyed {
  const parsed = parseSource(src);
  const byPath = new Map<string, string>();
  const byKey = new Map<string, Element>();
  const editEnd = side === "before" ? ap.editEndOld : ap.editEndNew;
  const delta = ap.editEndNew - ap.editEndOld;
  const regionCount = new Map<string, number>();
  const walk = (el: Element, path: string) => {
    const start = el.sourceCodeLocation?.startOffset;
    let key: string;
    if (start === undefined) key = `implicit:${el.tagName}:${path}`;
    else if (start >= ap.editStart && start < editEnd) {
      // Heading fixes change the tag (h5 -> h4): headings are one kind.
      const kind = /^h[1-6]$/.test(el.tagName) ? "h" : el.tagName;
      const n = regionCount.get(kind) ?? 0;
      regionCount.set(kind, n + 1);
      key = `${REGION}:${kind}:${n}`;
    } else if (side === "before" && start >= editEnd) key = `${el.tagName}@${start + delta}`;
    else key = `${el.tagName}@${start}`;
    byPath.set(path, key);
    byKey.set(key, el);
    elementChildren(el).forEach((c, i) => walk(c, path ? `${path}.${i}` : String(i)));
  };
  if (parsed.html) walk(parsed.html, "");
  return { byPath, byKey, src };
}

function describe(k: Keyed, key: string): string {
  const el = k.byKey.get(key);
  if (!el) return key;
  const line = el.sourceCodeLocation ? ` (line ${lineOfOffset(k.src, el.sourceCodeLocation.startOffset)})` : "";
  return `<${el.tagName}>${line}`;
}

/** Roles whose loss or hiding matters even without a name. */
const MEANINGFUL_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "slider",
  "spinbutton",
  "heading",
  "navigation",
  "main",
  "banner",
  "contentinfo",
  "complementary",
  "form",
  "search",
  "region",
  "dialog",
  "alert",
  "table",
  "list",
  "listitem",
]);

const EMPTY_ROLES = new Set(["", "none", "presentation", "generic", "InlineTextBox", "StaticText"]);

function axDiff(before: Record<string, AxInfo>, after: Record<string, AxInfo>, kb: Keyed, ka: Keyed): string[] {
  const b = new Map<string, AxInfo>();
  for (const [path, info] of Object.entries(before)) {
    const key = kb.byPath.get(path);
    if (key) b.set(key, info);
  }
  const a = new Map<string, AxInfo>();
  for (const [path, info] of Object.entries(after)) {
    const key = ka.byPath.get(path);
    if (key) a.set(key, info);
  }
  const out: string[] = [];
  for (const [key, x] of b) {
    if (x.ignored) continue;
    const y = a.get(key);
    const what = describe(kb, key);
    const meaningful = Boolean(x.name) || x.focusable || MEANINGFUL_ROLES.has(x.role);
    if (!y) {
      if (meaningful) out.push(`${what} with role ${x.role}${x.name ? ` and name ${JSON.stringify(x.name)}` : ""} was removed`);
      continue;
    }
    if (y.ignored) {
      if (meaningful) out.push(`${what} (${x.role}${x.name ? ` ${JSON.stringify(x.name)}` : ""}) is no longer exposed to assistive technology`);
      continue;
    }
    if (x.name && !y.name) out.push(`${what} lost its accessible name ${JSON.stringify(x.name)}`);
    if (MEANINGFUL_ROLES.has(x.role) && EMPTY_ROLES.has(y.role)) out.push(`${what} lost its role ${x.role} (now ${y.role || "none"})`);
    if (x.focusable && !y.focusable) out.push(`${what} is no longer focusable`);
    for (const s of Object.keys(x.states)) {
      if (s === "level" || s === "invalid") continue; // heading fixes change levels; invalid comes and goes with validation
      if (!(s in y.states)) out.push(`${what} lost its ${s} state`);
    }
  }
  // Generic or file-name names, on changed or new elements.
  for (const [key, y] of a) {
    if (y.ignored || !y.name) continue;
    const x = b.get(key);
    if (x && x.name === y.name) continue;
    const el = ka.byKey.get(key);
    const src = el ? (attr(el, "src") ?? "") : "";
    if (isGenericText(y.name)) out.push(`${describe(ka, key)} now has a generic name ${JSON.stringify(y.name)}`);
    else if (src && restatesFileName(y.name, src)) out.push(`${describe(ka, key)} has a name that only restates its file name: ${JSON.stringify(y.name)}`);
  }
  return out;
}

function multisetMinus(xs: string[], ys: string[]): string[] {
  const pool = new Map<string, number>();
  for (const y of ys) pool.set(y, (pool.get(y) ?? 0) + 1);
  const out: string[] = [];
  for (const x of xs) {
    const n = pool.get(x) ?? 0;
    if (n > 0) pool.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

function focusDiff(before: string[], after: string[], kb: Keyed, ka: Keyed) {
  const b = before.map((p) => kb.byPath.get(p) ?? `?${p}`);
  const a = after.map((p) => ka.byPath.get(p) ?? `?${p}`);
  const lostKeys = multisetMinus(b, a);
  const addedKeys = multisetMinus(a, b);
  const common = new Set(b.filter((k) => a.includes(k)));
  const bc = b.filter((k) => common.has(k));
  const ac = a.filter((k) => common.has(k));
  return {
    before: b.length,
    after: a.length,
    lost: lostKeys.map((k) => describe(kb, k)),
    added: addedKeys.map((k) => describe(ka, k)),
    reordered: bc.join("|") !== ac.join("|"),
  };
}

/* ---------------------------------------------------------------------- */

type Rect = [number, number, number, number];

/** Boxes of the patched elements: those starting inside the edit, the innermost container of the edit, and the target. */
function patchedRects(cap: VisualCapture, k: Keyed, extraKeys: string[]): Rect[] {
  const rects: Rect[] = [];
  for (const [path, key] of k.byPath) {
    if (!key.startsWith(`${REGION}:`) && !extraKeys.includes(key)) continue;
    const box = cap.boxes[path];
    if (box) rects.push(box);
  }
  return rects;
}

/** Key of the innermost element that contains the whole edit, unless it is html/head/body. */
function containerKey(k: Keyed, start: number, end: number): string | null {
  let best: { key: string; size: number } | null = null;
  for (const [key, el] of k.byKey) {
    const loc = el.sourceCodeLocation;
    if (!loc || ["html", "head", "body"].includes(el.tagName)) continue;
    if (loc.startOffset <= start && loc.endOffset >= end) {
      const size = loc.endOffset - loc.startOffset;
      if (!best || size < best.size) best = { key, size };
    }
  }
  return best?.key ?? null;
}

function layoutShift(b: VisualCapture, a: VisualCapture, kb: Keyed, ka: Keyed, skip: Set<string>): number {
  const after = new Map<string, Rect>();
  for (const [path, key] of ka.byPath) {
    const box = a.boxes[path];
    if (box) after.set(key, box);
  }
  let moved = 0;
  for (const [path, key] of kb.byPath) {
    if (skip.has(key) || key.startsWith(`${REGION}:`)) continue;
    const x = b.boxes[path];
    const y = after.get(key);
    if (!x || !y) continue;
    if (x.some((v, i) => Math.abs(v - y[i]!) > 1)) moved++;
  }
  return moved;
}

/** Pixel comparison in the browser (no image library needed). */
async function pixelDiff(beforePng: string, afterPng: string, mask: Rect[]): Promise<{ changed: number; compared: number }> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.evaluate("globalThis.__name = globalThis.__name || ((f) => f)");
    return await page.evaluate(
      async ({ a, b, mask }) => {
        const load = async (b64: string) => createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.min(ia.width, ib.width);
        const h = Math.min(ia.height, ib.height);
        const px = (img: ImageBitmap) => {
          const c = new OffscreenCanvas(w, h);
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, w, h).data;
        };
        const da = px(ia);
        const db = px(ib);
        const masked = new Uint8Array(w * h);
        for (const [x, y, rw, rh] of mask) {
          for (let yy = Math.max(0, y - 2); yy < Math.min(h, y + rh + 2); yy++) {
            masked.fill(1, yy * w + Math.max(0, x - 2), yy * w + Math.min(w, x + rw + 2));
          }
        }
        let changed = 0;
        let compared = 0;
        for (let i = 0; i < w * h; i++) {
          if (masked[i]) continue;
          compared++;
          const o = i * 4;
          if (
            Math.abs(da[o]! - db[o]!) > 24 ||
            Math.abs(da[o + 1]! - db[o + 1]!) > 24 ||
            Math.abs(da[o + 2]! - db[o + 2]!) > 24
          ) {
            changed++;
          }
        }
        // Area present in only one of the two captures counts as changed.
        const extra = Math.max(ia.width, ib.width) * Math.max(ia.height, ib.height) - w * h;
        return { changed: changed + extra, compared: compared + extra };
      },
      { a: beforePng, b: afterPng, mask },
    );
  } finally {
    await context.close();
  }
}

/* ---------------------------------------------------------------------- */

export async function deepCheck(
  src: string,
  ap: AppliedPatch,
  before: Probe,
  after: Probe,
  finding: Finding,
  opts: DeepCheckOptions,
): Promise<DeepCheckResult> {
  const kb = keyElements(src, ap, "before");
  const ka = keyElements(ap.patched, ap, "after");
  const result: DeepCheckResult = { reasons: [] };

  if (opts.ax && before.ax && after.ax) {
    result.ax = axDiff(before.ax, after.ax, kb, ka);
    result.reasons.push(...result.ax.map((c) => `accessibility tree: ${c}`));
  }

  if (opts.focus && before.focus && after.focus) {
    const f = focusDiff(before.focus, after.focus, kb, ka);
    result.focus = f;
    if (f.lost.length) result.reasons.push(`focus order: removed from the tab order: ${f.lost.join(", ")}`);
    if (f.reordered) result.reasons.push("focus order: the Tab sequence of untouched elements changed");
  }

  if (opts.visual.length && before.visual && after.visual) {
    result.visual = [];
    // The target element and the innermost element around the edit may change appearance.
    const targetKey = finding.sourceRange
      ? [...kb.byKey].find(([, el]) => el.sourceCodeLocation?.startOffset === finding.sourceRange!.start)?.[0]
      : undefined;
    const cb = containerKey(kb, ap.editStart, ap.editEndOld);
    const ca = containerKey(ka, ap.editStart, ap.editEndNew);
    const extra = [targetKey, cb, ca].filter((x): x is string => Boolean(x));
    // Elements containing the edit resize with it: not a shift.
    const ancestors = new Set<string>();
    for (const [key, el] of kb.byKey) {
      const loc = el.sourceCodeLocation;
      if (loc && loc.startOffset <= ap.editStart && loc.endOffset >= ap.editEndOld) ancestors.add(key);
    }
    for (const vb of before.visual) {
      const va = after.visual.find((v) => v.viewport === vb.viewport);
      if (!va) continue;
      const mask = [...patchedRects(vb, kb, extra), ...patchedRects(va, ka, extra)];
      const px = await pixelDiff(vb.png, va.png, mask);
      const d: VisualDiff = {
        viewport: vb.viewport,
        changeOutside: px.compared ? px.changed / px.compared : 0,
        changedPixelsOutside: px.changed,
        size: [vb.width, vb.height, va.width, va.height],
        layoutShift: layoutShift(vb, va, kb, ka, new Set([...ancestors, ...extra])),
      };
      result.visual.push(d);
      if (d.layoutShift === 0 && d.changeOutside > opts.maxVisualChange) {
        result.reasons.push(
          `visual (${d.viewport}): ${(d.changeOutside * 100).toFixed(2)}% of the page changed outside the patched elements (limit ${(opts.maxVisualChange * 100).toFixed(2)}%)`,
        );
      }
      if (opts.maxLayoutShift !== null && d.layoutShift > opts.maxLayoutShift) {
        result.reasons.push(`visual (${d.viewport}): ${d.layoutShift} element(s) outside the patch moved or resized (limit ${opts.maxLayoutShift})`);
      }
    }
  }
  return result;
}
