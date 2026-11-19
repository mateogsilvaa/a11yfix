// Tier 1: the LLM generator. Used only for findings that need judgment
// (image-alt, contrast, ambiguous ARIA) or that a tier-0 codemod declined.
//
// One finding per request; strict JSON output; invalid output retried at
// most twice, the third failure is a discard. This is the only part of
// a11yfix that talks to a network service other than the page under audit,
// and it is optional.

import Anthropic from "@anthropic-ai/sdk";
import { describeContext } from "./context.js";
import type { Rule } from "./rule.js";
import { truncate, withLineNumbers } from "./source.js";
import { ZERO_USAGE, addUsage, type Finding, type GenerationResult, type Patch, type Usage } from "./types.js";
import { MAX_HUNKS, MAX_LINES, PATCH_JSON_SCHEMA, parsePatch } from "./validate.js";

export interface Generator {
  readonly name: string;
  generate(finding: Finding, src: string, rule?: Rule): Promise<GenerationResult>;
}

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

export function buildFindingPrompt(f: Finding, rule?: Rule): string {
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
${rule?.guidance ?? "(none)"}

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
  readonly model: string;
  private client: Anthropic;
  private effort: Effort;
  private maxRetries: number;

  constructor(opts: LlmOptions = {}) {
    this.client = opts.client ?? new Anthropic();
    this.model = opts.model ?? DEFAULT_MODEL;
    this.effort = opts.effort ?? "medium";
    this.maxRetries = opts.maxRetries ?? 2;
    this.name = `llm:${this.model}:${this.effort}`;
  }

  async generate(finding: Finding, src: string, rule?: Rule): Promise<GenerationResult> {
    const started = Date.now();
    let usage: Usage = ZERO_USAGE;
    const done = (patch: Patch | null, error: string | null, attempts: number): GenerationResult => ({
      patch,
      error,
      attempts,
      usage,
      ms: Date.now() - started,
      tier: 1,
    });
    const fileBlock = `Source file ${finding.sourceFile}, with line numbers (the "NNN | " prefixes are not part of the file):\n\n${withLineNumbers(src)}`;

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: "user",
        content: [
          // The file is identical for every finding on a page: cache it.
          { type: "text", text: fileBlock, cache_control: { type: "ephemeral" } },
          { type: "text", text: buildFindingPrompt(finding, rule) },
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
          throw new Error(`${(err as Error).message}\nSet ANTHROPIC_API_KEY, or use --mode codemod (no model).`);
        }
        // The SDK already retried transient errors (429/5xx/network).
        const msg = err instanceof Anthropic.APIError ? `API error ${err.status}: ${err.message}` : (err as Error).message;
        return done(null, msg, attempt);
      }
      usage = addUsage(usage, {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
      });

      if (res.stop_reason === "refusal") return done(null, "model refused", attempt);

      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const check = checkJson(text);
      if (check.ok) return done(check.patch, null, attempt);

      lastError = res.stop_reason === "max_tokens" ? "output truncated (max_tokens)" : check.reason;
      // Ask again, showing the model what was wrong.
      messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      messages.push({
        role: "user",
        content: `That response was not valid: ${lastError}. Reply again with only the JSON object (findingId, rationale, before, after, confidence).`,
      });
    }
    return done(null, `invalid output after ${attempts} attempts: ${lastError}`, attempts);
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
