// LLM generator tests with a fake client: retry policy and output handling.
// No network, no API key.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { HeuristicGenerator, LlmGenerator, buildFindingPrompt } from "../src/generate.ts";
import type { Finding } from "../src/types.ts";

const finding: Finding = {
  id: "f_0001",
  ruleId: "image-alt",
  wcag: ["1.1.1"],
  impact: "critical",
  selector: "img",
  nodeIndex: 0,
  outerHTML: '<img src="chart.png">',
  sourceSnippet: '<img src="chart.png">',
  ancestorChain: ["figure", "main", "body"],
  sourceFile: "page.html",
  sourceLines: { start: 3, end: 3 },
  sourceRange: { start: 30, end: 51 },
  help: "Images must have alternative text",
  description: "Ensure <img> elements have alternative text",
  helpUrl: "https://dequeuniversity.com/rules/axe/4.14/image-alt",
  failureSummary: "Fix any of the following: Element does not have an alt attribute",
  checks: [],
  context: { tagName: "img", attributes: { src: "chart.png" }, text: "", nearbyText: 'figcaption: "Sales"', computedStyle: {} },
};

const SRC = '<html>\n<body>\n<figure><img src="chart.png"><figcaption>Sales</figcaption></figure>\n</body>\n</html>\n';

const good = JSON.stringify({
  findingId: "f_0001",
  rationale: "chart",
  before: '<img src="chart.png">',
  after: '<img src="chart.png" alt="">',
  confidence: "medium",
});

function fakeClient(replies: Array<{ text: string; stop?: string }>) {
  const calls: unknown[] = [];
  const client = {
    beta: {
      messages: {
        create: async (body: unknown) => {
          calls.push(structuredClone(body));
          const r = replies.shift();
          if (!r) throw new Error("no more replies");
          return {
            content: [{ type: "text", text: r.text }],
            stop_reason: r.stop ?? "end_turn",
            usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 },
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe("LlmGenerator", () => {
  it("returns the patch on the first valid reply", async () => {
    const { client, calls } = fakeClient([{ text: good }]);
    const r = await new LlmGenerator({ client }).generate(finding, SRC);
    assert.equal(r.attempts, 1);
    assert.equal(r.patch?.after, '<img src="chart.png" alt="">');
    assert.equal(calls.length, 1);
    assert.equal(r.usage.cacheReadTokens, 50);
  });

  it("retries invalid JSON and succeeds on the third attempt", async () => {
    const { client, calls } = fakeClient([{ text: "```json\n{}" }, { text: '{"findingId":"f_0001"}' }, { text: good }]);
    const r = await new LlmGenerator({ client }).generate(finding, SRC);
    assert.equal(r.attempts, 3);
    assert.ok(r.patch);
    assert.equal(calls.length, 3);
    assert.equal(r.usage.inputTokens, 300);
  });

  it("discards after the third invalid reply (max 2 retries)", async () => {
    const { client, calls } = fakeClient([{ text: "nope" }, { text: "nope" }, { text: "nope" }, { text: good }]);
    const r = await new LlmGenerator({ client }).generate(finding, SRC);
    assert.equal(r.patch, null);
    assert.equal(calls.length, 3);
    assert.match(r.error ?? "", /after 3 attempts/);
  });

  it("does not retry a refusal", async () => {
    const { client, calls } = fakeClient([{ text: "", stop: "refusal" }, { text: good }]);
    const r = await new LlmGenerator({ client }).generate(finding, SRC);
    assert.equal(r.patch, null);
    assert.equal(calls.length, 1);
  });

  it("sends the file once, cached, and the finding after it", async () => {
    const { client, calls } = fakeClient([{ text: good }]);
    await new LlmGenerator({ client }).generate(finding, SRC);
    const body = calls[0] as { messages: Array<{ content: Array<{ text: string; cache_control?: unknown }> }> };
    const [fileBlock, findingBlock] = body.messages[0]!.content;
    assert.ok(fileBlock!.cache_control);
    assert.match(fileBlock!.text, /3 \| <figure>/);
    assert.match(findingBlock!.text, /Finding id: f_0001/);
  });
});

describe("prompt", () => {
  it("includes rule help, truncated markup, context and constraints", () => {
    const p = buildFindingPrompt(finding);
    for (const s of ["image-alt", "WCAG 1.1.1", "dequeuniversity.com", "figcaption", "at most 6 lines", 'findingId "f_0001"']) {
      assert.ok(p.includes(s), `prompt is missing ${s}`);
    }
  });
});

describe("HeuristicGenerator", () => {
  it("derives alt text from the file name", async () => {
    const r = await new HeuristicGenerator().generate({ ...finding, sourceRange: { start: SRC.indexOf("<img"), end: SRC.indexOf("<figcaption") } }, SRC);
    assert.equal(r.patch?.after, '<img src="chart.png" alt="Chart">');
  });
});
