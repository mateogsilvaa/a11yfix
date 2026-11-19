// Mapping between what the browser sees and the bytes on disk.
//
// axe reports nodes in the live DOM. Patches must be applied to the source
// file. We bridge the two with an element path (child-element indexes from
// <html>) computed in the browser, then walk the same path in a parse5 tree
// built with source locations. parse5 implements the WHATWG parsing algorithm,
// so for static pages (page scripts blocked by CSP) both trees match. The
// browser still has scripting enabled, so parse5 must parse <noscript> the
// same way (as raw text): scriptingEnabled stays true.

import { parse, type DefaultTreeAdapterTypes as T } from "parse5";
import type { SourceLocation, SourceRange } from "./types.js";

export type Element = T.Element;

export interface ParsedSource {
  html: Element | null;
}

export function parseSource(src: string): ParsedSource {
  const doc = parse(src, { sourceCodeLocationInfo: true, scriptingEnabled: true });
  const html = doc.childNodes.find(isElement) ?? null;
  return { html };
}

export function isElement(node: T.ChildNode | T.Node): node is Element {
  return (node as Element).tagName !== undefined;
}

export function elementChildren(el: Element): Element[] {
  return el.childNodes.filter(isElement);
}

export function elementAtPath(parsed: ParsedSource, path: number[]): Element | null {
  let cur = parsed.html;
  for (const idx of path) {
    if (!cur) return null;
    cur = elementChildren(cur)[idx] ?? null;
  }
  return cur;
}

/** Depth-first list of every element in document order. */
export function allElements(parsed: ParsedSource): Element[] {
  const out: Element[] = [];
  const walk = (el: Element) => {
    out.push(el);
    for (const c of elementChildren(el)) walk(c);
  };
  if (parsed.html) walk(parsed.html);
  return out;
}

export function attr(el: Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

/** Source range of the whole element, if the parser saw it in the source (implicit elements have none). */
export function elementRange(el: Element): SourceRange | null {
  const loc = el.sourceCodeLocation;
  if (!loc) return null;
  return { start: loc.startOffset, end: loc.endOffset };
}

export function elementLines(el: Element): SourceLocation | null {
  const loc = el.sourceCodeLocation;
  if (!loc) return null;
  return { start: loc.startLine, end: loc.endLine };
}

/** Line (1-based) of a character offset. */
export function lineOfOffset(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

/** The file with right-aligned line numbers, as shown to the model. */
export function withLineNumbers(src: string): string {
  const lines = src.split(/\r?\n/);
  const width = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(width)} | ${l}`).join("\n");
}

export function detectEol(src: string): "\r\n" | "\n" {
  return src.includes("\r\n") ? "\r\n" : "\n";
}

/** Normalize a model-produced snippet to the file's line endings. */
export function toEol(text: string, eol: "\r\n" | "\n"): string {
  const lf = text.replace(/\r\n/g, "\n");
  return eol === "\n" ? lf : lf.replace(/\n/g, "\r\n");
}

/** All start offsets of `needle` in `hay`. */
export function occurrences(hay: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(needle, i + 1);
  }
  return out;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}
