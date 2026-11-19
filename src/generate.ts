// Patch generators.
//
// - LlmGenerator: asks Claude for one minimal patch per finding, as strict
//   JSON. Invalid output is retried at most twice; the third failure is a
//   discard.
// - HeuristicGenerator: a deterministic, rule-by-rule baseline with no model.
//   It exists to exercise the pipeline offline and as a comparison point: it
//   produces the kind of "fix" a naive tool would, and the verifier should
//   catch the bad ones.

import Anthropic from "@anthropic-ai/sdk";
import { describeContext } from "./context.js";
import { ruleSpec } from "./rules.js";
import { allElements, attr, parseSource, truncate, withLineNumbers } from "./source.js";
import { ZERO_USAGE, addUsage, type Finding, type GenerationResult, type Patch, type Usage } from "./types.js";
import { MAX_HUNKS, MAX_LINES, PATCH_JSON_SCHEMA, parsePatch } from "./validate.js";

export interface Generator {
  readonly name: string;
  generate(finding: Finding, src: string): Promise<GenerationResult>;
}

/* ====================================================================== */
/* LLM generator                                                          */
/* ====================================================================== */

export const DEFAULT_MODEL = process.env.A11YFIX_MODEL ?? "claude-opus-5-5";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const SYSTEM_PROMPT = `You are a senior accessibility engineer who knows WCAG 2.2 in depth. You fix exactly one axe-core violation per request by proposing the smallest possible patch to an HTML source file. You never rewrite, reformat or modernize code that is not part of the fix.

Rules:
1. Fix exactly one violation: the one described in the request, on the target node.
2. "after" must resolve that violation and only that violation. Do not fix other problems you notice.
3. Do not change styling unless the rule requires it (color-contrast).
4. For image-alt: describe the image's function (what it communicates or does), not its appearance. If the image is decorative, use alt="".
5. "before" must be copied verbatim from the source file: same characters, same whitespace, same attribute order and quoting, and without the line-number prefixes shown in the listing. Make it as short as possible while still unique; usually the element's start tag, or the whole element when it is short.
6. "after" is "before" with the minimal change applied. The diff must touch at most ${MAX_LINES} lines in at most ${MAX_HUNKS} places.
7. Never silence the rule instead of fixing it: no aria-hidden="true", no role="presentation" or role="none", no hiding with CSS or the hidden attribute, no deleting the element, no generic text such as "image", "icon" or "field".
8. If you are unsure (for example, the image's purpose cannot be known from the page), still give your best minimal patch and set confidence to "low".

Respond with only a JSON object with the fields findingId, rationale, before, after, confidence. No markdown, no prose around it.`;

export function buildFindingPrompt(f: Finding): string {
  const spec = ruleSpec(f.ruleId);
  const lines = f.sourceLines ? `lines ${f.sourceLines.start}-${f.sourceLines.end}` : "unknown lines";
  return `Fix this violation.

Finding id: ${f.id}
Rule: ${f.ruleId} (WCAG ${f.wcag.join(", ") || "n/a"}, impact ${f.impact ?? "n/a"})
Rule help: ${f.help}
Rule description: ${f.description}
More info: ${f.helpUrl}

axe failure summary for this node:
${f.failureSummary}

Target node: ${f.selector} (${lines} of ${f.sourceFile})
Source text of the target element:
${f.sourceSnippet ? truncate(f.sourceSnippet, 2000) : "(could not be mapped to the source; use the DOM serialization below)"}

DOM serialization (outerHTML, truncated to 2000 chars):
${f.outerHTML}

Context:
${describeContext(f)}

Rule-specific guidance:
${spec?.guidance ?? "(none)"}

Constraints: one violation; minimal patch; "before" is an exact, verbatim substring of the file (no line numbers); at most ${MAX_LINES} lines changed in at most ${MAX_HUNKS} places; "after" non-empty. Use findingId "${f.id}".`;
}

export interface LlmOptions {
  model?: string;
  effort?: Effort;
  maxRetries?: number;
  client?: Anthropic;
}

export class LlmGenerator implements Generator {
  readonly name: string;
  private client: Anthropic;
  private model: string;
  private effort: Effort;
  private maxRetries: number;

  constructor(opts: LlmOptions = {}) {
    this.client = opts.client ?? new Anthropic();
    this.model = opts.model ?? DEFAULT_MODEL;
    this.effort = opts.effort ?? "medium";
    this.maxRetries = opts.maxRetries ?? 2;
    this.name = `llm:${this.model}:${this.effort}`;
  }

  async generate(finding: Finding, src: string): Promise<GenerationResult> {
    const started = Date.now();
    let usage: Usage = ZERO_USAGE;
    const fileBlock = `Source file ${finding.sourceFile}, with line numbers (the "NNN | " prefixes are not part of the file):\n\n${withLineNumbers(src)}`;

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: "user",
        content: [
          // The file is identical for every finding on a page: cache it.
          { type: "text", text: fileBlock, cache_control: { type: "ephemeral" } },
          { type: "text", text: buildFindingPrompt(finding) },
        ],
      },
    ];

    let lastError = "no attempt made";
    const attempts = this.maxRetries + 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let res: Anthropic.Beta.BetaMessage;
      try {
        res = await this.client.beta.messages.create({
          model: this.model,
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages,
          output_config: { effort: this.effort, format: { type: "json_schema", schema: PATCH_JSON_SCHEMA } },
          // Re-run a safety-classifier decline on Anthropic's recommended fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } catch (err) {
        // Missing or bad credentials affect every finding: stop the run instead of
        // recording hundreds of identical failures.
        if (err instanceof Anthropic.AuthenticationError || /authentication method/i.test((err as Error).message)) {
          throw new Error(
            `${(err as Error).message}\nSet ANTHROPIC_API_KEY, or use --generator heuristic for the offline baseline.`,
          );
        }
        // The SDK already retried transient errors (429/5xx/network).
        const msg = err instanceof Anthropic.APIError ? `API error ${err.status}: ${err.message}` : (err as Error).message;
        return { patch: null, error: msg, attempts: attempt, usage, ms: Date.now() - started };
      }
      usage = addUsage(usage, {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
      });

      if (res.stop_reason === "refusal") {
        return { patch: null, error: "model refused", attempts: attempt, usage, ms: Date.now() - started };
      }

      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const check = checkJson(text);
      if (check.ok) return { patch: check.patch, error: null, attempts: attempt, usage, ms: Date.now() - started };

      lastError = res.stop_reason === "max_tokens" ? "output truncated (max_tokens)" : check.reason;
      // Ask again, showing the model what was wrong.
      messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      messages.push({
        role: "user",
        content: `That response was not valid: ${lastError}. Reply again with only the JSON object (findingId, rationale, before, after, confidence).`,
      });
    }
    return { patch: null, error: `invalid output after ${attempts} attempts: ${lastError}`, attempts, usage, ms: Date.now() - started };
  }
}

function checkJson(text: string): { ok: true; patch: Patch } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch (e) {
    return { ok: false, reason: `not JSON (${(e as Error).message})` };
  }
  return parsePatch(raw);
}

/** Rough USD estimate per million tokens: [input, output, cache read, cache write]. */
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-sonnet-5-5": [2, 10, 0.1, 2.5],
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125],
  "claude-fable-5-2": [8, 40, 0.2, 10],
};

export function estimateUsd(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (u.inputTokens * p[0] + u.outputTokens * p[1] + u.cacheReadTokens * p[2] + u.cacheWriteTokens * p[3]) / 1e6;
}

/* ====================================================================== */
/* Heuristic baseline                                                     */
/* ====================================================================== */

const REQUIRED_DEFAULTS: Record<string, string> = {
  "aria-checked": "false",
  "aria-expanded": "false",
  "aria-selected": "false",
  "aria-pressed": "false",
  "aria-level": "2",
  "aria-valuenow": "0",
  "aria-valuemin": "0",
  "aria-valuemax": "100",
  "aria-orientation": "horizontal",
};

function humanize(s: string): string {
  return s
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const ATTR_RE = (name: string) => new RegExp(`\\s${name.replace(/[-]/g, "\\-")}(\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?`, "i");

function removeAttr(tag: string, name: string): string {
  return tag.replace(ATTR_RE(name), "");
}

function setAttr(tag: string, name: string, value: string): string {
  const re = ATTR_RE(name);
  const piece = ` ${name}="${escapeAttr(value)}"`;
  if (re.test(tag)) return tag.replace(re, piece);
  return tag.replace(/\s*(\/?)>$/, (_m, slash: string) => `${piece}${slash ? " /" : ""}>`);
}

/** Attribute names from axe check data such as ['aria-checked="yes"'] or ['aria-checked']. */
function attrNamesFromChecks(f: Finding, checkIds: string[]): string[] {
  const names = new Set<string>();
  for (const c of f.checks) {
    if (!checkIds.includes(c.id)) continue;
    // axe uses several shapes: ["aria-x=\"v\""], {values: [...]}, or a plain string.
    const d0 = c.data as unknown;
    const data: unknown[] = Array.isArray(d0)
      ? d0
      : d0 && typeof d0 === "object" && Array.isArray((d0 as { values?: unknown }).values)
        ? (d0 as { values: unknown[] }).values
        : [d0];
    for (const d of data) {
      if (typeof d !== "string") continue;
      const m = /^(aria-[a-z]+)/i.exec(d.trim());
      if (m) names.add(m[1]!.toLowerCase());
    }
  }
  return [...names];
}

function relLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class HeuristicGenerator implements Generator {
  readonly name = "heuristic";

  async generate(finding: Finding, src: string): Promise<GenerationResult> {
    const started = Date.now();
    const done = (patch: Patch | null, error: string | null): GenerationResult => ({
      patch,
      error,
      attempts: 1,
      usage: ZERO_USAGE,
      ms: Date.now() - started,
    });
    if (!finding.sourceRange) return done(null, "heuristic: target not mapped to source");

    const parsed = parseSource(src);
    const el = allElements(parsed).find((e) => e.sourceCodeLocation?.startOffset === finding.sourceRange!.start);
    const loc = el?.sourceCodeLocation;
    if (!el || !loc?.startTag) return done(null, "heuristic: element not found in source");
    const startTag = src.slice(loc.startTag.startOffset, loc.startTag.endOffset);

    const make = (before: string, after: string, rationale: string): GenerationResult =>
      done({ findingId: finding.id, rationale, before, after, confidence: "low" }, null);

    switch (finding.ruleId) {
      case "image-alt": {
        const srcAttr = attr(el, "src") ?? "";
        const name = humanize(srcAttr.split(/[\\/]/).pop() ?? "");
        return make(startTag, setAttr(startTag, "alt", name), `alt derived from file name "${srcAttr}"`);
      }
      case "label": {
        const basis = attr(el, "name") ?? attr(el, "id") ?? attr(el, "placeholder") ?? attr(el, "type") ?? el.tagName;
        return make(startTag, setAttr(startTag, "aria-label", humanize(basis)), `aria-label derived from "${basis}"`);
      }
      case "heading-order": {
        const outline = finding.context.headingOutline ?? [];
        const idx = outline.findIndex((h) => h.isTarget);
        const prev = idx > 0 ? outline[idx - 1]!.level : 0;
        const target = Math.min(6, prev + 1);
        const snippet = finding.sourceSnippet ?? "";
        const m = /^<h([1-6])/i.exec(snippet);
        if (!m) return done(null, "heuristic: target is not an <hN> element");
        const after = snippet
          .replace(/^<h[1-6]/i, `<h${target}`)
          .replace(/<\/h[1-6]>$/i, `</h${target}>`);
        return make(snippet, after, `heading level set to previous level + 1 (h${target})`);
      }
      case "aria-roles":
        return make(startTag, removeAttr(startTag, "role"), "removed invalid role");
      case "aria-allowed-attr":
      case "aria-valid-attr-value": {
        const names = attrNamesFromChecks(finding, ["aria-allowed-attr", "aria-valid-attr-value", "aria-prohibited-attr"]);
        if (!names.length) return done(null, "heuristic: offending attribute not found in axe data");
        let after = startTag;
        for (const n of names) after = removeAttr(after, n);
        return make(startTag, after, `removed ${names.join(", ")}`);
      }
      case "aria-required-attr": {
        const names = attrNamesFromChecks(finding, ["aria-required-attr"]);
        const known = names.filter((n) => REQUIRED_DEFAULTS[n] !== undefined);
        if (!known.length) return done(null, `heuristic: no default for ${names.join(", ") || "missing attribute"}`);
        let after = startTag;
        for (const n of known) after = setAttr(after, n, REQUIRED_DEFAULTS[n]!);
        return make(startTag, after, `added ${known.join(", ")} with default values`);
      }
      case "color-contrast": {
        const data = finding.checks.find((c) => c.id === "color-contrast")?.data as { bgColor?: string } | null;
        const bg = data?.bgColor ? parseHex(data.bgColor) : null;
        const color = bg && relLuminance(bg) < 0.18 ? "#ffffff" : "#000000";
        const style = attr(el, "style");
        const after = setAttr(startTag, "style", style ? `color: ${color}; ${style}` : `color: ${color}`);
        return make(startTag, after, `inline text color ${color} against background ${data?.bgColor ?? "unknown"}`);
      }
      default:
        return done(null, `heuristic: no strategy for ${finding.ruleId}`);
    }
  }
}
