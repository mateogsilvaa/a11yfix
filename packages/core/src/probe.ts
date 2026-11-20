// Page probes for the verifier, beyond axe:
//   - the browser's accessibility tree (role, name, description, states of
//     every element), read over CDP: what assistive technology actually gets;
//   - the sequential focus order, by pressing Tab;
//   - full-page screenshots and element boxes per viewport, for visual diffs.
//
// Elements are identified by their element path (child-element indexes from
// <html>), which the verifier maps to source offsets with parse5, exactly as
// for axe nodes.

import type { CDPSession, Page } from "playwright";

export interface AxInfo {
  role: string;
  name: string;
  description: string;
  ignored: boolean;
  focusable: boolean;
  /** States and properties that matter to users: checked, expanded, pressed, level, ... */
  states: Record<string, string>;
}

export interface VisualCapture {
  viewport: string;
  width: number;
  height: number;
  /** PNG, base64. */
  png: string;
  /** Element path -> [x, y, width, height] in page coordinates (non-empty boxes only). */
  boxes: Record<string, [number, number, number, number]>;
}

export interface Probe {
  ax: Record<string, AxInfo> | null;
  focus: string[] | null;
  visual: VisualCapture[] | null;
}

export interface ProbeOptions {
  ax?: boolean;
  focus?: boolean;
  /** Viewports for visual captures; empty or undefined: no captures. */
  visual?: Array<{ name: string; width: number; height: number }>;
}

const STATE_PROPS = new Set([
  "checked",
  "expanded",
  "pressed",
  "selected",
  "disabled",
  "required",
  "invalid",
  "level",
  "readonly",
  "multiselectable",
  "haspopup",
  "valuetext",
  "valuenow",
  "modal",
]);

const MAX_TABS = 400;

export async function probePage(page: Page, opts: ProbeOptions): Promise<Probe> {
  const probe: Probe = { ax: null, focus: null, visual: null };
  if (opts.ax) {
    const cdp = await page.context().newCDPSession(page);
    try {
      probe.ax = await axByPath(cdp);
    } finally {
      await cdp.detach();
    }
  }
  if (opts.focus) probe.focus = await focusOrder(page);
  if (opts.visual?.length) {
    const original = page.viewportSize();
    probe.visual = [];
    for (const vp of opts.visual) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const png = (await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" })).toString("base64");
      const { width, height, boxes } = await page.evaluate(collectBoxes);
      probe.visual.push({ viewport: vp.name, width, height, png, boxes });
    }
    if (original) await page.setViewportSize(original);
  }
  return probe;
}

interface DomNode {
  nodeType: number;
  nodeName: string;
  backendNodeId: number;
  children?: DomNode[];
}

interface AxValue {
  value?: unknown;
}

interface AxNode {
  ignored: boolean;
  role?: AxValue;
  name?: AxValue;
  description?: AxValue;
  properties?: Array<{ name: string; value: AxValue }>;
  backendDOMNodeId?: number;
}

async function axByPath(cdp: CDPSession): Promise<Record<string, AxInfo>> {
  const { root } = (await cdp.send("DOM.getDocument", { depth: -1, pierce: false })) as { root: DomNode };
  const pathOf = new Map<number, string>();
  const html = root.children?.find((c) => c.nodeType === 1);
  const walk = (node: DomNode, path: string) => {
    pathOf.set(node.backendNodeId, path);
    let i = 0;
    for (const c of node.children ?? []) {
      if (c.nodeType !== 1) continue;
      walk(c, path ? `${path}.${i}` : String(i));
      i++;
    }
  };
  if (html) walk(html, "");

  const { nodes } = (await cdp.send("Accessibility.getFullAXTree", {})) as { nodes: AxNode[] };
  const out: Record<string, AxInfo> = {};
  for (const n of nodes) {
    if (n.backendDOMNodeId === undefined) continue;
    const path = pathOf.get(n.backendDOMNodeId);
    if (path === undefined) continue;
    const states: Record<string, string> = {};
    let focusable = false;
    for (const p of n.properties ?? []) {
      if (p.name === "focusable") focusable = p.value.value === true;
      else if (STATE_PROPS.has(p.name) && p.value.value !== undefined) states[p.name] = String(p.value.value);
    }
    out[path] = {
      role: String(n.role?.value ?? ""),
      name: String(n.name?.value ?? "").trim(),
      description: String(n.description?.value ?? "").trim(),
      ignored: n.ignored,
      focusable,
      states,
    };
  }
  return out;
}

/** Element paths in the order Tab visits them. */
async function focusOrder(page: Page): Promise<string[]> {
  const order: string[] = [];
  // Probes run right after load, before anything took focus, so the first
  // Tab starts at the top of the document. (Clicking to reset focus could
  // follow a link.)
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    const p = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const out: number[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.documentElement) {
        const parent: Element | null = cur.parentElement;
        if (!parent) return null;
        out.unshift(Array.prototype.indexOf.call(parent.children, cur));
        cur = parent;
      }
      return out.join(".");
    });
    if (p === null) break; // focus left the document
    if (order.length > 0 && p === order[0]) break; // wrapped around
    order.push(p);
  }
  // Leave no focus ring or scroll offset behind for the screenshots.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.scrollTo(0, 0);
  });
  return order;
}

/* Runs in the page. */
function collectBoxes(): { width: number; height: number; boxes: Record<string, [number, number, number, number]> } {
  const boxes: Record<string, [number, number, number, number]> = {};
  const walk = (el: Element, path: string) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      boxes[path] = [Math.round(r.left + window.scrollX), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)];
    }
    Array.from(el.children).forEach((c, i) => walk(c, path ? `${path}.${i}` : String(i)));
  };
  walk(document.documentElement, "");
  const d = document.documentElement;
  return { width: Math.max(d.scrollWidth, d.clientWidth), height: Math.max(d.scrollHeight, d.clientHeight), boxes };
}
