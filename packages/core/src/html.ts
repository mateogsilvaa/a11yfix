// Small, exact string edits on start tags, for codemods. Codemods work on the
// exact source text so their `before` is always a verbatim substring.

import { allElements, attr, elementChildren, isElement, type Element, type ParsedSource } from "./source.js";
import type { DefaultTreeAdapterTypes as T } from "parse5";
import type { SourceRange } from "./types.js";

const attrRe = (name: string) =>
  new RegExp(`(\\s)${name.replace(/[-]/g, "\\-")}(\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?(?=[\\s/>])`, "i");

export function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Remove an attribute from a start tag string. */
export function removeAttr(tag: string, name: string): string {
  return tag.replace(attrRe(name), "");
}

/** Set (replace or append) an attribute on a start tag string. */
export function setAttr(tag: string, name: string, value: string): string {
  const re = attrRe(name);
  const piece = `${name}="${escapeAttr(value)}"`;
  if (re.test(tag)) return tag.replace(re, (_m, ws: string) => `${ws}${piece}`);
  return tag.replace(/\s*(\/?)>$/, (_m, slash: string) => ` ${piece}${slash ? " /" : ""}>`);
}

/** Source text and range of an element's start tag. */
export function startTagOf(src: string, el: Element): { text: string; range: SourceRange } | null {
  const st = el.sourceCodeLocation?.startTag;
  if (!st) return null;
  return { text: src.slice(st.startOffset, st.endOffset), range: { start: st.startOffset, end: st.endOffset } };
}

/** The element whose source starts at `offset`. */
export function elementStartingAt(parsed: ParsedSource, offset: number): Element | null {
  return allElements(parsed).find((e) => e.sourceCodeLocation?.startOffset === offset) ?? null;
}

export function collectIds(parsed: ParsedSource): Set<string> {
  const ids = new Set<string>();
  for (const el of allElements(parsed)) {
    const id = attr(el, "id");
    if (id) ids.add(id);
  }
  return ids;
}

/** A fresh id based on `base` that is not in `ids`. */
export function uniqueId(base: string, ids: Set<string>): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "field";
  let id = clean;
  for (let i = 2; ids.has(id); i++) id = `${clean}-${i}`;
  return id;
}

export function isText(node: T.ChildNode): node is T.TextNode {
  return node.nodeName === "#text";
}

/** Visible-ish text content of an element (text nodes only, whitespace-collapsed). */
export function textContent(el: Element): string {
  const out: string[] = [];
  const walk = (n: Element) => {
    for (const c of n.childNodes) {
      if (isText(c)) out.push(c.value);
      else if (isElement(c) && c.tagName !== "script" && c.tagName !== "style") walk(c);
    }
  };
  walk(el);
  return out.join("").replace(/\s+/g, " ").trim();
}

export function parentElement(el: Element): Element | null {
  const p = el.parentNode as Element | null;
  return p && (p as Element).tagName ? p : null;
}

/** Child nodes ignoring whitespace-only text and comments. */
export function meaningfulChildren(el: Element): T.ChildNode[] {
  return el.childNodes.filter((c) => (isText(c) ? c.value.trim() !== "" : isElement(c)));
}

export { elementChildren };

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m]![n]!;
}
