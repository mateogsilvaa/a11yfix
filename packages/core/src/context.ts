// Context extractor: what the model gets to see about a violating node,
// beyond the raw markup. Gathered in the browser at audit time (computed
// styles and the heading outline only exist there) and stored in
// findings.json, so `fix` never needs a browser.

import { truncate } from "./source.js";
import type { Finding, NodeContext } from "./types.js";

/**
 * Runs inside the page (serialized by Playwright). Must be self-contained.
 */
export function extractNodeContext(el: Element, ruleId: string): NodeContext {
  const clip = (s: string | null | undefined, n: number) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };

  const attributes: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) attributes[a.name] = clip(a.value, 200);

  const nearby: string[] = [];
  const figure = el.closest("figure");
  const caption = figure?.querySelector("figcaption");
  if (caption) nearby.push(`figcaption: "${clip(caption.textContent, 200)}"`);
  const actionable = el.closest("a, button");
  if (actionable && actionable !== el) {
    const href = actionable.getAttribute("href");
    nearby.push(
      `inside <${actionable.tagName.toLowerCase()}${href ? ` href="${href}"` : ""}> with text "${clip(
        actionable.textContent,
        150,
      )}"`,
    );
  }
  const prev = el.previousElementSibling;
  if (prev) nearby.push(`previous sibling <${prev.tagName.toLowerCase()}>: "${clip(prev.textContent, 150)}"`);
  const next = el.nextElementSibling;
  if (next) nearby.push(`next sibling <${next.tagName.toLowerCase()}>: "${clip(next.textContent, 150)}"`);
  if (el.parentElement) nearby.push(`parent <${el.parentElement.tagName.toLowerCase()}> text: "${clip(el.parentElement.textContent, 300)}"`);

  const cs = getComputedStyle(el);
  const computedStyle: Record<string, string> = {
    color: cs.color,
    "background-color": cs.backgroundColor,
    "font-size": cs.fontSize,
    "font-weight": cs.fontWeight,
    display: cs.display,
  };

  const ctx: NodeContext = {
    tagName: el.tagName.toLowerCase(),
    attributes,
    text: clip((el as HTMLElement).innerText ?? el.textContent, 300),
    nearbyText: nearby.join("\n"),
    computedStyle,
  };

  if (ruleId === "heading-order") {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]"));
    ctx.headingOutline = headings.map((h) => {
      const aria = h.getAttribute("aria-level");
      const m = /^h([1-6])$/i.exec(h.tagName);
      const level = aria ? Number(aria) : m ? Number(m[1]) : 2;
      return { level, text: clip(h.textContent, 80), isTarget: h === el };
    });
  }
  return ctx;
}

/** Human-readable context block for the prompt. */
export function describeContext(f: Finding): string {
  const c = f.context;
  const parts: string[] = [];
  parts.push(`Element: <${c.tagName}>`);
  if (c.text) parts.push(`Element text: "${c.text}"`);
  if (c.nearbyText) parts.push(`Surroundings:\n${c.nearbyText}`);
  parts.push(`Ancestors (nearest first): ${f.ancestorChain.join(" > ") || "(none)"}`);
  parts.push(
    `Computed style: ${Object.entries(c.computedStyle)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ")}`,
  );
  if (c.headingOutline) {
    parts.push(
      "Heading outline of the page (document order):\n" +
        c.headingOutline
          .map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}h${h.level} "${h.text}"${h.isTarget ? "   <-- TARGET" : ""}`)
          .join("\n"),
    );
  }
  const checks = f.checks
    .map((ch) => `- ${ch.id}: ${ch.message}${ch.data ? ` (data: ${truncate(JSON.stringify(ch.data), 400)})` : ""}`)
    .join("\n");
  if (checks) parts.push(`axe checks that failed:\n${checks}`);
  return parts.join("\n\n");
}
