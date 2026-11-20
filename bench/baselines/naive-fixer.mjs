#!/usr/bin/env node
// Naive baseline for the benchmark: the quick fixes a tool would ship if it never checked its own work.
//
// It speaks the --generator-cmd protocol (--generator-input json): one request on stdin, one patch on stdout.
// Every heuristic below is common in "auto-fix" tools and snippets. None of them is deliberately sabotaged; they
// are simply unchecked. This is a strawman on purpose: its job is to measure what the verifier catches, not to
// rate fixers. Never use it to fix a real page.
//
//   image-alt              alt text from the file name ("hero-banner.jpg" -> "hero banner"), "image" if none
//   label                  aria-label from the placeholder, name or id, "field" if none
//   heading-order          re-level the flagged heading to one below the previous heading (siblings untouched)
//   aria-roles             remove the invalid role
//   aria-allowed-attr      remove the disallowed attributes
//   aria-valid-attr-value  remove the attribute with the invalid value
//   aria-required-attr     add the missing attributes with a default ("false", or "0" for values)
//   color-contrast         inline black or white text, whichever contrasts more with the reported background

import { readFileSync } from "node:fs";

const req = JSON.parse(readFileSync(0, "utf8"));
const f = req.finding;
const snippet = f.sourceSnippet;
if (!snippet) process.exit(0); // nothing to anchor on: no patch

const tagEnd = snippet.indexOf(">");
const startTag = tagEnd === -1 ? snippet : snippet.slice(0, tagEnd + 1);
// axe reports attribute lists either as an array or as {values: [...]}, depending on the check.
const checkData = (f.checks ?? []).flatMap((c) => (Array.isArray(c.data) ? c.data : Array.isArray(c.data?.values) ? c.data.values : []));
const attrNames = checkData.map((d) => String(d).split("=")[0].trim()).filter((n) => n.startsWith("aria-"));

const words = (s) =>
  s
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
const getAttr = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(2).find((x) => x !== undefined);
const escapeAttr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const addAttr = (tag, name, value) => tag.replace(/\s*(\/?)>$/, ` ${name}="${escapeAttr(value)}"$1>`);
const removeAttr = (tag, name) => tag.replace(new RegExp(`\\s+${name}(\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?`, "i"), "");

let before = startTag;
let after = null;
let rationale = "";

switch (f.ruleId) {
  case "image-alt": {
    const src = getAttr(startTag, "src") ?? "";
    const alt = words(src.split(/[\\/]/).pop() ?? "") || "image";
    after = /\salt\s*=/.test(startTag) ? startTag.replace(/\salt\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ` alt="${escapeAttr(alt)}"`) : addAttr(startTag, "alt", alt);
    rationale = "alt text from the file name";
    break;
  }
  case "label": {
    const name = getAttr(startTag, "placeholder") ?? getAttr(startTag, "name") ?? getAttr(startTag, "id") ?? "";
    after = addAttr(startTag, "aria-label", words(name) || "field");
    rationale = "aria-label from the placeholder, name or id";
    break;
  }
  case "heading-order": {
    const outline = f.context?.headingOutline ?? [];
    const i = outline.findIndex((h) => h.isTarget);
    const prev = i > 0 ? outline[i - 1].level : 0;
    const m = /^<h([1-6])/i.exec(snippet);
    if (!m) break;
    const level = Math.min(6, prev + 1);
    before = snippet;
    after = snippet.replace(/^<h[1-6]/i, `<h${level}`).replace(/<\/h[1-6]>$/i, `</h${level}>`);
    rationale = `re-level to h${level}, one below the previous heading`;
    break;
  }
  case "aria-roles":
    after = removeAttr(startTag, "role");
    rationale = "remove the invalid role";
    break;
  case "aria-allowed-attr":
  case "aria-valid-attr-value":
    after = attrNames.reduce(removeAttr, startTag);
    rationale = `remove ${attrNames.join(", ")}`;
    break;
  case "aria-required-attr":
    after = attrNames.reduce((t, n) => addAttr(t, n, /value/.test(n) ? "0" : "false"), startTag);
    rationale = `add ${attrNames.join(", ")} with a default value`;
    break;
  case "color-contrast": {
    const data = (f.checks ?? []).find((c) => c.data && typeof c.data === "object" && !Array.isArray(c.data))?.data ?? {};
    const hex = /^#([0-9a-f]{6})$/i.exec(String(data.bgColor ?? "#ffffff"))?.[1] ?? "ffffff";
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    const color = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#000000" : "#ffffff";
    const style = getAttr(startTag, "style");
    after =
      style !== undefined
        ? startTag.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ` style="color: ${color}; ${escapeAttr(style)}"`)
        : addAttr(startTag, "style", `color: ${color}`);
    rationale = `inline text color ${color}`;
    break;
  }
}

if (after === null || after === before) process.exit(0);
process.stdout.write(JSON.stringify({ findingId: f.id, rationale, before, after, confidence: "medium" }));
